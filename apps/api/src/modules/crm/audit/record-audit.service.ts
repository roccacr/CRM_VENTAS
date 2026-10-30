import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, Logger, type OnModuleInit, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { type Selectable, sql, type Transaction } from "kysely";
import { ulid } from "ulid";
import { z } from "zod";

import { DatabaseService } from "../../../database/database.service.js";
import type { CrmDatabase } from "../../../database/database.types.js";
import { type AuditActorSnapshot, getCapturedAuditActor, readAuditActor } from "./audit-actor.js";
import type { AuditRecordEventTable } from "./record-audit.tables.js";
import { prepareRecordAuditChange } from "./record-audit-change.js";

/** Identifier text: no surrounding spaces or control characters. */
const identifier = (maximum: number) =>
    z
        .string()
        .min(1)
        .max(maximum)
        .refine((value) => value.trim() === value && !/\p{Cc}/u.test(value));
const sourceSchema = z.enum(["CRM_THINK_V2", "crmdatabase-api"]);
const physicalName = z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z][a-z0-9_]*$/);
const effectiveSourceSchema = z.object({ schema: sourceSchema, table: physicalName, id: identifier(191) }).strict();
const actorSchema = z.object({ publicId: identifier(191), name: z.string().min(1).max(250), roles: z.array(z.object({ code: identifier(100), name: z.string().min(1).max(250) }).strict()).max(100) }).strict();
const inputSchema = z
    .object({
        source: effectiveSourceSchema.extend({ entity: physicalName }),
        effectiveSource: effectiveSourceSchema.optional(),
        actor: actorSchema,
        action: z.enum(["create", "update", "state_change", "approval_change", "revert", "annotation"]),
        module: identifier(64),
        before: z.record(z.string(), z.unknown()).nullable(),
        after: z.record(z.string(), z.unknown()).nullable(),
        allowedFields: z.array(z.string().min(1)).min(1).max(100),
        operationId: identifier(100),
        correlationId: identifier(100),
        reason: z.string().max(1000).nullable().optional(),
        snapshotScope: z.literal("partial"),
        expectedSequence: z.number().int().min(0).max(4294967294).optional(),
        requestId: identifier(100).optional(),
        ipAddress: z.string().max(80).optional(),
        userAgent: z.string().max(500).optional(),
    })
    .strict();

/** Input contract; `allowedFields` is a plain array for callers while validation uses the schema. */
export type RecordAuditInput = Omit<z.infer<typeof inputSchema>, "allowedFields"> & { allowedFields: readonly string[] };
const requiredMigrations = ["202610220023_record_audit", "202610220024_record_audit_identifier_collation"];
/** Result of validating and diffing the snapshots. */
type PreparedChange = ReturnType<typeof prepareRecordAuditChange>;

/** Runtime validation is needed even for JavaScript consumers of the typed internal API. */
function assertTransaction(executor: unknown): asserts executor is Transaction<CrmDatabase> {
    if (executor === null || typeof executor !== "object" || Reflect.get(executor, "isTransaction") !== true) throw new BadRequestException("Record audit requires a business transaction");
}

/** Creates need no `before`, other actions need both snapshots, and a revert needs a reason. */
function assertSnapshots(data: z.infer<typeof inputSchema>): void {
    if (data.action === "revert" && !data.reason?.trim()) throw new BadRequestException("A reversal requires a reason");
    if (data.action === "annotation") return;
    const invalidBefore = data.action === "create" ? data.before !== null : data.before === null;
    if (invalidBefore || data.after === null) throw new BadRequestException("Invalid record audit snapshots");
}

/** Validates the event shape, builds the diff and requires an actor captured by the server. */
function prepareInput(input: RecordAuditInput) {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException("Invalid record audit event");
    assertSnapshots(parsed.data);
    const change = prepareRecordAuditChange(parsed.data);
    const actor = getCapturedAuditActor(input.actor);
    if (!actor) throw new ForbiddenException("Audit actor must be captured by the server before mutation");
    return { data: parsed.data, change, actor };
}

/** Serialized snapshots, null when the record did not exist on that side. */
const snapshotValues = (change: PreparedChange) => ({ before_record_event: change.before === null ? null : JSON.stringify(change.before), after_record_event: change.after === null ? null : JSON.stringify(change.after), changes_record_event: JSON.stringify(change.changes) });
/** Optional request metadata columns. */
const requestValues = (data: RecordAuditInput) => ({ request_id_record_event: data.requestId ?? null, ip_address_record_event: data.ipAddress ?? null, user_agent_record_event: data.userAgent ?? null });

/** Per-record version: rejects a stale expected version and the overflow of the 32-bit counter. */
function nextSequence(previous: number, expected: number | undefined): number {
    if (expected !== undefined && expected !== previous) throw new ConflictException("Audit version changed; reload the record");
    if (previous >= 4294967295) throw new ConflictException("Audit version limit reached");
    return previous + 1;
}

/** A successful retry returns the old event, never a new observation of the same operation. */
function assertSameOperation(replay: Selectable<AuditRecordEventTable>, prepared: ReturnType<typeof prepareInput>): void {
    const { data, change, actor } = prepared;
    const effective = data.effectiveSource ?? data.source;
    const original = prepareRecordAuditChange({ before: decodeSnapshot(replay.before_record_event), after: decodeSnapshot(replay.after_record_event), allowedFields: data.allowedFields });
    const previous = [replay.action_record_event, replay.module_record_event, replay.actor_reference_record_event, replay.reason_record_event, replay.source_schema_record_event, replay.source_table_record_event, replay.source_id_record_event, replay.snapshot_scope_record_event, replay.snapshot_version_record_event, original.before, original.after];
    const requested = [data.action, data.module, actor.publicId, data.reason ?? null, effective.schema, effective.table, effective.id, "partial", 1, change.before, change.after];
    if (JSON.stringify(previous) !== JSON.stringify(requested)) throw new ConflictException("Audit operation reused with different content");
}

/** Converts mysql2 JSON results without depending on its string/object representation. */
function decodeSnapshot(value: unknown): Record<string, unknown> | null {
    const decoded: unknown = typeof value === "string" ? JSON.parse(value) : value;
    if (decoded === null) return null;
    if (typeof decoded !== "object" || Array.isArray(decoded)) throw new ConflictException("Invalid historical snapshot");
    return decoded as Record<string, unknown>;
}

/** Shared append-only writer; callers authorize resources and pass their OWN business transaction. */
@Injectable()
export class RecordAuditService implements OnModuleInit {
    readonly enabled: boolean;

    /** Defaults protect existing manual consumers; Nest injects the validated runtime configuration. */
    constructor(
        @Inject(DatabaseService) private readonly database: DatabaseService,
        @Inject(ConfigService) config: ConfigService = new ConfigService(),
    ) {
        this.enabled = config.get<boolean>("ENABLE_RECORD_AUDIT") === true;
    }

    /** Enabling against an unprepared schema fails before requests are accepted. No automatic DDL. */
    async onModuleInit(): Promise<void> {
        if (!this.enabled) return;
        // Retry this read-only startup gate only; commands and audit writes must never be replayed here.
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                await this.assertReady(this.database.db);
                return;
            } catch (error) {
                const code: unknown = error instanceof Error ? Reflect.get(error, "code") : undefined;
                if (attempt === 2 || !["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "PROTOCOL_CONNECTION_LOST"].includes(String(code))) throw error;
                Logger.warn({ event: "record_audit_startup_connection_retry", attempt: attempt + 2 }, RecordAuditService.name);
                await new Promise<void>((resolve) => setTimeout(resolve, (attempt + 1) * 1000));
            }
        }
    }

    private async assertReady(executor: DatabaseService["db"]): Promise<void> {
        const destination = await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(executor);
        if (destination.rows[0]?.name !== "CRM_THINK_V2") throw new ServiceUnavailableException("Record audit destination is not prepared");
        const migrations = await sql<{ name: string }>`SELECT migration_name_schema_migration AS name FROM conf_schema_migration WHERE migration_name_schema_migration IN (${sql.join(requiredMigrations)})`.execute(executor);
        if (!requiredMigrations.every((name) => migrations.rows.some((row) => row.name === name))) throw new ServiceUnavailableException("Record audit requires migrations 023 and 024");
    }

    /** Resolve authenticated actor details from the server before mutating the aggregate. */
    async captureActor(tx: Transaction<CrmDatabase>, actorUserId: number): Promise<AuditActorSnapshot> {
        assertTransaction(tx);
        const actor = await readAuditActor(tx, actorUserId, true);
        if (!actor) throw new ForbiddenException("Audit actor is unavailable");
        return actor;
    }

    /** Strict partial snapshots cannot be used to claim full restoration support. */
    async append(tx: Transaction<CrmDatabase>, input: RecordAuditInput): Promise<{ publicId: string; sequence: number; replayed: boolean }> {
        assertTransaction(tx);
        if (!this.enabled) throw new ServiceUnavailableException("Record audit is disabled");
        const prepared = prepareInput(input);
        const { data, change, actor } = prepared;
        await this.assertReady(tx);
        const record = await this.lockRecord(tx, data.source);
        const effective = data.effectiveSource ?? data.source;
        const replay = await tx.selectFrom("audit_record_event").selectAll().where("record_id_record_event", "=", record.id).where("operation_id_record_event", "=", data.operationId).forUpdate().executeTakeFirst();
        if (replay) {
            assertSameOperation(replay, prepared);
            return { publicId: replay.id_record_event, sequence: replay.sequence_record_event, replayed: true };
        }
        const last = await tx.selectFrom("audit_record_event").select("sequence_record_event as sequence").where("record_id_record_event", "=", record.id).orderBy("sequence_record_event", "desc").limit(1).forUpdate().executeTakeFirst();
        const publicId = ulid();
        const sequence = nextSequence(last?.sequence ?? 0, data.expectedSequence);
        await tx
            .insertInto("audit_record_event")
            .values({
                id_record_event: publicId,
                record_id_record_event: record.id,
                sequence_record_event: sequence,
                action_record_event: data.action,
                module_record_event: data.module,
                origin_record_event: "crm",
                source_schema_record_event: effective.schema,
                source_table_record_event: effective.table,
                source_id_record_event: effective.id,
                actor_kind_record_event: "user",
                actor_reference_record_event: actor.publicId,
                actor_snapshot_record_event: JSON.stringify(actor),
                occurred_at_record_event: sql<Date>`UTC_TIMESTAMP(3)`,
                operation_id_record_event: data.operationId,
                correlation_id_record_event: data.correlationId,
                reason_record_event: data.reason ?? null,
                snapshot_version_record_event: 1,
                snapshot_scope_record_event: "partial",
                ...snapshotValues(change),
                restored_sequence_record_event: null,
                ...requestValues(data),
            })
            .execute();
        return { publicId, sequence, replayed: false };
    }

    /** Caller holds the business-parent lock; errors here must abort that entire transaction. */
    private async lockRecord(tx: Transaction<CrmDatabase>, source: RecordAuditInput["source"]): Promise<{ id: string }> {
        const record = await tx.selectFrom("audit_record").select("id_record as id").where("source_schema_record", "=", source.schema).where("entity_type_record", "=", source.entity).where("source_table_record", "=", source.table).where("source_id_record", "=", source.id).forUpdate().executeTakeFirst();
        if (record) return record;
        const id = ulid();
        await tx.insertInto("audit_record").values({ id_record: id, source_schema_record: source.schema, entity_type_record: source.entity, source_table_record: source.table, source_id_record: source.id }).execute();
        return { id };
    }
}
