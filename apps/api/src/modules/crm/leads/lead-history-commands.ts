import { isDeepStrictEqual } from "node:util";

import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { sql, type Transaction } from "kysely";
import { ulid } from "ulid";
import { z } from "zod";

import type { DatabaseService } from "../../../database/database.service.js";
import type { CrmDatabase } from "../../../database/database.types.js";
import type { RecordAuditService } from "../audit/record-audit.service.js";

const common = { leadPublicId: z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/), actorUserId: z.number().int().positive(), operationId: z.string().min(1).max(100), expectedVersion: z.number().int().nonnegative(), detail: z.string().trim().min(1).max(60000) };
const commandSchema = z.discriminatedUnion("kind", [z.object({ ...common, kind: z.literal("activity"), actionCode: z.string().min(1).max(80), reasonCode: z.string().min(1).max(80).nullable() }).strict(), z.object({ ...common, kind: z.literal("status"), toStatusCode: z.string().min(1).max(48), reasonCode: z.string().min(1).max(80) }).strict()]);
type Command = z.infer<typeof commandSchema>;
type Lead = { id: number; version: number; stage: string; status: string; deleted: Date | null };

/** Internal commands, not HTTP handlers. Callers must authorize the resource before invocation. */
export class LeadHistoryCommands {
    /** Reuses the native database and the existing transactional audit writer. */
    constructor(
        private readonly database: Pick<DatabaseService, "db">,
        private readonly audit: Pick<RecordAuditService, "captureActor" | "append">,
    ) {}

    /** Validate an authorized internal command before opening its business transaction. */
    async execute(value: unknown) {
        const parsed = commandSchema.safeParse(value);
        if (!parsed.success) throw new BadRequestException("Invalid lead history command");
        const command = parsed.data;
        return this.database.db.transaction().execute((tx) => this.apply(tx, command));
    }

    private async apply(tx: Transaction<CrmDatabase>, command: Command) {
        const lead = await tx.selectFrom("crm_lead").select(["id_lead as id", "version_lead as version", "status_code_lead as stage", "status_lead as status", "deleted_at_lead as deleted"]).where("public_id_lead", "=", command.leadPublicId).forUpdate().executeTakeFirst();
        if (!lead || lead.deleted || lead.status !== "active") throw new NotFoundException("Active lead unavailable");
        const actor = await this.audit.captureActor(tx, command.actorUserId);
        const source = await this.source(tx, lead.id);
        const record = await tx.selectFrom("audit_record").select("id_record as id").where("source_schema_record", "=", source.schema).where("entity_type_record", "=", "lead").where("source_table_record", "=", source.table).where("source_id_record", "=", source.id).forUpdate().executeTakeFirst();
        const replay = record ? await tx.selectFrom("audit_record_event").select(["id_record_event as publicId", "after_record_event as snapshot"]).where("record_id_record_event", "=", record.id).where("operation_id_record_event", "=", command.operationId).executeTakeFirst() : undefined;
        if (replay) return this.replay(replay, command);
        if (lead.version !== command.expectedVersion) throw new ConflictException("Lead version changed; reload");
        const reason = await this.validate(tx, command);
        return this.persist(tx, { command, lead, reason, actor, source });
    }

    private async persist(tx: Transaction<CrmDatabase>, context: { command: Command; lead: Lead; reason: { code: string; name: string } | null; actor: Awaited<ReturnType<RecordAuditService["captureActor"]>>; source: Awaited<ReturnType<LeadHistoryCommands["source"]>> }) {
        const { command, lead, reason, actor, source } = context;
        const historyEntry = this.describe(command, lead, reason);
        const event = await this.audit.append(tx, {
            source,
            effectiveSource: { schema: "CRM_THINK_V2", table: "crm_lead", id: String(lead.id) },
            actor,
            action: command.kind === "status" ? "state_change" : "annotation",
            module: "ventas",
            before: { statusCode: lead.stage },
            after: { statusCode: command.kind === "status" ? command.toStatusCode : lead.stage, historyEntry, historyCommand: command },
            allowedFields: ["statusCode", "historyEntry", "historyCommand"],
            operationId: command.operationId,
            correlationId: command.operationId,
            reason: reason?.name ?? null,
            snapshotScope: "partial",
        });
        await this.specialized(tx, command, lead, { id: event.publicId, reasonName: reason?.name ?? null });
        await tx
            .updateTable("crm_lead")
            .set({ version_lead: lead.version + 1, updated_by_user_id_lead: command.actorUserId, ...(command.kind === "status" ? { status_code_lead: command.toStatusCode } : {}) })
            .where("id_lead", "=", lead.id)
            .execute();
        return { publicId: event.publicId, replayed: false, version: lead.version + 1 };
    }

    private describe(command: Command, lead: Lead, reason: { code: string; name: string } | null) {
        if (command.kind === "status" && command.toStatusCode === lead.stage) throw new BadRequestException("Lead is already in that stage");
        return { actionCode: command.kind === "status" ? "status_changed" : command.actionCode, reason, detail: command.detail, fromStatusCode: command.kind === "status" ? lead.stage : null, toStatusCode: command.kind === "status" ? command.toStatusCode : null, occurredAt: new Date().toISOString(), evidence: "native_event" };
    }

    private replay(row: { publicId: string; snapshot: unknown }, command: Command) {
        const snapshot: unknown = typeof row.snapshot === "string" ? JSON.parse(row.snapshot) : row.snapshot;
        const prior = z.object({ historyCommand: commandSchema }).safeParse(snapshot);
        if (!prior.success || !isDeepStrictEqual(prior.data.historyCommand, command)) throw new ConflictException("History operation reused with different content");
        return { publicId: row.publicId, replayed: true };
    }

    private async source(tx: Transaction<CrmDatabase>, leadId: number) {
        const linked = await tx.selectFrom("int_lead_history_link").innerJoin("audit_record", "audit_record.id_record", "int_lead_history_link.record_id_lead_history_link").select(["source_schema_record as schema", "source_table_record as table", "source_id_record as id"]).where("lead_id_lead_history_link", "=", leadId).executeTakeFirst();
        if (!linked) return { schema: "CRM_THINK_V2" as const, entity: "lead", table: "crm_lead", id: String(leadId) };
        if (linked.schema !== "crmdatabase-api" || linked.table !== "leads") throw new ConflictException("Invalid historical identity link");
        return { ...linked, schema: "crmdatabase-api" as const, entity: "lead" };
    }

    private async validate(tx: Transaction<CrmDatabase>, command: Command) {
        if (command.kind === "activity") {
            const type = await tx.selectFrom("conf_lead_action_type").select("code_lead_action_type").where("code_lead_action_type", "=", command.actionCode).where("status_lead_action_type", "=", "active").forUpdate().executeTakeFirst();
            if (!type || command.actionCode === "legacy_observation") throw new BadRequestException("Active activity type required");
        } else {
            const status = await tx.selectFrom("conf_lead_status").select("code_lead_status").where("code_lead_status", "=", command.toStatusCode).where("status_lead_status", "=", "active").forUpdate().executeTakeFirst();
            if (!status) throw new BadRequestException("Active destination stage required");
        }
        if (!command.reasonCode) return null;
        return this.reason(tx, command);
    }

    private async reason(tx: Transaction<CrmDatabase>, command: Command) {
        const reason = await tx
            .selectFrom("conf_action_reason")
            .select(["code_action_reason as code", "name_action_reason as name"])
            .where("code_action_reason", "=", command.reasonCode ?? "")
            .where("status_action_reason", "=", "active")
            .forUpdate()
            .executeTakeFirst();
        const allowed =
            command.kind === "status"
                ? await tx.selectFrom("conf_action_reason_status").select("reason_code_action_reason_status").where("status_code_action_reason_status", "=", command.toStatusCode).where("reason_code_action_reason_status", "=", command.reasonCode).where("status_action_reason_status", "=", "active").forUpdate().executeTakeFirst()
                : await tx
                      .selectFrom("conf_action_reason_action")
                      .select("reason_code_action_reason_action")
                      .where("action_code_action_reason_action", "=", command.actionCode)
                      .where("reason_code_action_reason_action", "=", command.reasonCode ?? "")
                      .where("status_action_reason_action", "=", "active")
                      .forUpdate()
                      .executeTakeFirst();
        if (!reason || !allowed) throw new BadRequestException("Active applicable reason required");
        return reason;
    }

    private async specialized(tx: Transaction<CrmDatabase>, command: Command, lead: Lead, event: { id: string; reasonName: string | null }) {
        const { id: eventId, reasonName } = event;
        if (command.kind === "activity") {
            await tx.insertInto("crm_lead_activity").values({ public_id_lead_activity: ulid(), lead_id_lead_activity: lead.id, action_code_lead_activity: command.actionCode, reason_code_lead_activity: command.reasonCode, detail_lead_activity: command.detail, actor_user_id_lead_activity: command.actorUserId, operation_id_lead_activity: command.operationId, event_id_lead_activity: eventId }).execute();
            return;
        }
        const previous = await tx
            .selectFrom("audit_lead_status_event")
            .select(sql<number>`COALESCE(MAX(sequence_lead_status_event),0)`.as("sequence"))
            .where("lead_id_lead_status_event", "=", lead.id)
            .executeTakeFirstOrThrow();
        await tx
            .insertInto("audit_lead_status_event")
            .values({
                public_id_lead_status_event: ulid(),
                lead_id_lead_status_event: lead.id,
                sequence_lead_status_event: previous.sequence + 1,
                event_kind_lead_status_event: "transition",
                from_status_code_lead_status_event: lead.stage,
                to_status_code_lead_status_event: command.toStatusCode,
                reason_code_lead_status_event: command.reasonCode,
                reason_name_snapshot_lead_status_event: reasonName,
                comment_lead_status_event: command.detail,
                actor_kind_lead_status_event: "user",
                actor_user_id_lead_status_event: command.actorUserId,
                external_system_id_lead_status_event: null,
                operation_id_lead_status_event: command.operationId,
                occurred_at_lead_status_event: sql<Date>`UTC_TIMESTAMP(3)`,
            })
            .execute();
    }

    /** Explicit promotion hook, called inside the authorized import transaction before new native events. */
    async linkNative(tx: Transaction<CrmDatabase>, leadId: number, recordId: string): Promise<void> {
        const lead = await tx.selectFrom("crm_lead").select("id_lead").where("id_lead", "=", leadId).forUpdate().executeTakeFirst();
        const record = await tx.selectFrom("audit_record").select("id_record").where("id_record", "=", recordId).where("entity_type_record", "=", "lead").where("source_schema_record", "=", "crmdatabase-api").where("source_table_record", "=", "leads").forUpdate().executeTakeFirst();
        const native = await tx.selectFrom("audit_record").select("id_record").where("source_schema_record", "=", "CRM_THINK_V2").where("entity_type_record", "=", "lead").where("source_table_record", "=", "crm_lead").where("source_id_record", "=", String(leadId)).executeTakeFirst();
        if (!lead || !record || native) throw new ConflictException("History link requires an unambiguous original identity and no split native history");
        await tx.insertInto("int_lead_history_link").values({ lead_id_lead_history_link: leadId, record_id_lead_history_link: recordId }).execute();
    }
}
