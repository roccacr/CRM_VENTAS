import "dotenv/config";

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { ConfigService } from "@nestjs/config";
import { type Kysely, sql, type Transaction } from "kysely";
import { ulid } from "ulid";
import { z } from "zod";

import { DatabaseService } from "../src/database/database.service.js";
import type { CrmDatabase } from "../src/database/database.types.js";
import { buildAuditChangeSet } from "../src/modules/crm/audit/audit-change-set.js";
import { RecordAuditService } from "../src/modules/crm/audit/record-audit.service.js";
import { SecurityAuditService } from "../src/modules/crm/audit/security-audit.service.js";
import { readSchemaMigrationEnv } from "./run-schema-migrations.js";

interface SourceUser {
    id: number;
    name: string | null;
    email: string | null;
    status: number;
}
interface NativeUser {
    email: string;
    deleted: Date | string | null;
}
class ImportError extends Error {}
function reject(message: string): never {
    throw new ImportError(message);
}
const tables = ["sec_user", "audit_security_event", "audit_record", "audit_record_event"];
const profileSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1)
        .max(180)
        .regex(/^[^\p{Cc}]*$/u),
    email: z.string().trim().max(255).pipe(z.email()),
    status: z.union([z.literal(0), z.literal(1)]),
});

/** Email-only creation: existing accounts, credentials, roles and ERP references are never changed. */
export function planLegacyUsers(source: readonly SourceUser[], users: readonly NativeUser[]) {
    const creates: { name: string; email: string; normalizedEmail: string; status: "pending" | "inactive" }[] = [];
    const seen = new Set<string>();
    let existing = 0;
    for (const row of source) {
        const parsed = profileSchema.safeParse(row);
        if (!parsed.success) reject(`Invalid source record ${String(row.id)}`);
        const { email, name } = parsed.data;
        const normalizedEmail = email.toLowerCase();
        if (seen.has(normalizedEmail)) continue;
        seen.add(normalizedEmail);
        const match = users.find((user) => user.email.toLowerCase() === normalizedEmail);
        if (match?.deleted) reject(`Deleted native identity at source record ${String(row.id)}`);
        if (match) {
            existing++;
            continue;
        }
        creates.push({ name, email, normalizedEmail, status: row.status === 1 ? "pending" : "inactive" });
    }
    return { sourceTotal: source.length, existing, creates };
}

/** Read only the four required source columns; never select secrets or historical permissions. */
export async function readLegacyUserPlan(db: Kysely<CrmDatabase>, lock = false) {
    const source = (await sql<SourceUser>`SELECT id_admin AS id,name_admin AS name,email_admin AS email,status_admin AS status FROM ${sql.table("crmdatabase-api.admins")} ORDER BY id_admin`.execute(db)).rows;
    let query = db.selectFrom("sec_user").select(["normalized_email_user as email", "deleted_at_user as deleted"]);
    if (lock) query = query.forUpdate();
    return planLegacyUsers(source, await query.execute());
}

/** Fail closed before writes to any schema except the explicitly authorized native database. */
async function assertDestination(db: Kysely<CrmDatabase>) {
    if ((await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(db)).rows[0]?.name !== "CRM_THINK_V2") reject("Import requires CRM_THINK_V2");
    const engines = (await sql<{ engine: string }>`SELECT ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (${sql.join(tables)})`.execute(db)).rows;
    if (engines.length !== tables.length || engines.some((table) => table.engine !== "InnoDB")) reject("Import requires existing InnoDB user/audit tables");
}

/** Count-only output without names, addresses or connection details. */
export function summarize(plan: Awaited<ReturnType<typeof readLegacyUserPlan>>) {
    return { sourceTotal: plan.sourceTotal, existingUsers: plan.existing, newUsers: plan.creates.length, pending: plan.creates.filter((user) => user.status === "pending").length, inactive: plan.creates.filter((user) => user.status === "inactive").length };
}

/** Explicit confirmation is required; invoking the command without --apply is read-only. */
export function parseImportArgs(args: string[]) {
    const { values } = parseArgs({ args, strict: true, options: { apply: { type: "boolean", default: false }, confirm: { type: "string" }, actor: { type: "string" }, "expected-new": { type: "string" }, "expected-source": { type: "string" } } });
    if (!values.apply) return values;
    const confirmed = z.object({ confirm: z.literal("CRM_THINK_V2"), actor: z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/u), "expected-new": z.string().regex(/^\d+$/u), "expected-source": z.string().regex(/^\d+$/u) }).safeParse(values);
    if (!confirmed.success) reject("Apply requires native confirmation, Owner and expected counts");
    return values;
}

async function requireOwner(tx: Transaction<CrmDatabase>, publicId: string) {
    const actor = await tx.selectFrom("sec_user").select(["id_user", "status_user", "deleted_at_user"]).where("public_id_user", "=", publicId).forUpdate().executeTakeFirst();
    if (!actor || actor.status_user !== "active" || actor.deleted_at_user !== null) reject("Active Owner required");
    const owner = await tx.selectFrom("sec_user_role as assignment").innerJoin("sec_role as role", "role.id_role", "assignment.role_id_user_role").select("role.id_role").where("assignment.user_id_user_role", "=", actor.id_user).where("assignment.status_user_role", "=", "active").where("assignment.revoked_at_user_role", "is", null).where("role.code_role", "=", "owner").where("role.status_role", "=", "active").where("role.deleted_at_role", "is", null).forUpdate().executeTakeFirst();
    if (!owner) reject("Active Owner required");
    return actor;
}

async function main() {
    const options = parseImportArgs(process.argv.slice(2));
    const env = readSchemaMigrationEnv({ ...process.env, MIGRATION_CONFIRM_SCHEMA_ONLY: "CRM_THINK_V2" });
    const database = new DatabaseService(new ConfigService(env));
    try {
        await assertDestination(database.db);
        if (!options.apply) {
            console.log(JSON.stringify({ mode: "dry-run", ...summarize(await readLegacyUserPlan(database.db)) }));
            return;
        }
        const records = new RecordAuditService(database, new ConfigService({ ENABLE_RECORD_AUDIT: true }));
        await records.onModuleInit();
        const audit = new SecurityAuditService(database, records);
        const runId = ulid();
        console.log(JSON.stringify({ mode: "started", runId }));
        const plan = await database.db.transaction().execute(async (tx) => {
            // Lock the current operator before scanning users; concurrent imports serialize here.
            const actor = await requireOwner(tx, String(options.actor));
            const now = new Date();
            const denies = await tx
                .selectFrom("sec_user_permission_override as override")
                .innerJoin("sec_permission as permission", "permission.id_permission", "override.permission_id_user_permission_override")
                .select("permission.id_permission")
                .where("override.user_id_user_permission_override", "=", actor.id_user)
                .where("permission.code_permission", "=", "user.create")
                .where("override.effect_user_permission_override", "=", "deny")
                .where("override.status_user_permission_override", "=", "active")
                .where("override.revoked_at_user_permission_override", "is", null)
                .where("override.starts_at_user_permission_override", "<=", now)
                .where((eb) => eb.or([eb("override.ends_at_user_permission_override", "is", null), eb("override.ends_at_user_permission_override", ">", now)]))
                .forUpdate()
                .execute();
            if (denies.length) reject("Owner has a user.create deny");
            const actorSnapshot = await audit.captureActor(actor.id_user, tx);
            if (!actorSnapshot) reject("Actor snapshot unavailable");
            const pending = await readLegacyUserPlan(tx, true);
            if (pending.sourceTotal !== Number(options["expected-source"]) || pending.creates.length !== Number(options["expected-new"])) reject("Counts changed; repeat dry run");
            for (const user of pending.creates) {
                const publicId = ulid();
                const inserted = await tx.insertInto("sec_user").values({ public_id_user: publicId, email_user: user.email, normalized_email_user: user.normalizedEmail, display_name_user: user.name, status_user: user.status, permission_version_user: 1, last_login_at_user: null, created_at_user: now, updated_at_user: now, created_by_user_id_user: actor.id_user, updated_by_user_id_user: actor.id_user, deleted_at_user: null, deleted_by_user_id_user: null }).executeTakeFirstOrThrow();
                const id = Number(inserted.insertId);
                if (!Number.isSafeInteger(id) || id <= 0) reject("Invalid inserted identity");
                await audit.record(
                    {
                        eventType: "user_created",
                        actorUserId: actor.id_user,
                        actorSnapshot,
                        targetUserId: id,
                        summary: "Usuario creado por correo, sin credenciales ni permisos.",
                        reason: "Creacion de perfiles autorizada por el propietario",
                        userAgent: "authorized-cli/email-user-import",
                        metadata: { moduleCode: "administration", sectionCode: "users", importRunId: runId, executionMode: "authorized_cli", changeSet: buildAuditChangeSet({ entity: "user", recordId: publicId, action: "create", before: null, after: { displayName: user.name, email: user.email, status: user.status, deleted: false, roleCodes: [], orgUnitCodes: [], accessMethods: [], externalReferences: [] } }) },
                    },
                    tx,
                );
            }
            return pending;
        });
        console.log(JSON.stringify({ mode: "committed", runId, ...summarize(plan) }));
    } finally {
        await database.onModuleDestroy();
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
    main().catch((error: unknown) => {
        console.error(error instanceof ImportError ? error.message : "Import failed; inspect persisted audit by run id before retrying.");
        process.exitCode = 1;
    });
