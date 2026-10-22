import { ConfigService } from "@nestjs/config";
import { config } from "dotenv";
import { type Kysely, sql, type Transaction } from "kysely";
import { ulid } from "ulid";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { validateEnv } from "../../src/config/env.validation.js";
import { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import { type LifecycleContext, SalesOrderLifecycleRepository } from "../../src/modules/crm/sales/sales-orders/sales-order-lifecycle.repository.js";

describe.skipIf(process.env.SALES_ORDER_MYSQL_TESTS !== "1")("sales order lifecycle on real MySQL (rollback only)", () => {
    let database: DatabaseService;
    beforeAll(() => {
        config({ quiet: true });
        database = new DatabaseService(new ConfigService(validateEnv(process.env)));
    });
    afterAll(async () => database.onModuleDestroy());

    async function fixture(run: (repo: SalesOrderLifecycleRepository, tx: Transaction<CrmDatabase>, context: LifecycleContext) => Promise<void>, failApproval = false) {
        const rollback = new Error("rollback sales order fixtures");
        try {
            await database.db.transaction().execute(async (tx) => {
                const actor = ulid();
                const orderId = ulid();
                const email = `sales-order-${actor}@example.invalid`;
                await sql`INSERT INTO sec_user (public_id_user,email_user,normalized_email_user,display_name_user,status_user) VALUES (${actor},${email},${email},'Lifecycle rollback actor','active')`.execute(tx);
                await tx
                    .insertInto("crm_sales_order")
                    .values({
                        public_id_sales_order: orderId,
                        native_code_sales_order: `TEST-${orderId}`,
                        status_sales_order: "active",
                        cancelled_sales_order: "no",
                        id_old_produccion_sales_order: null,
                        unit_file_id_sales_order: null,
                        subsidiary_id_sales_order: null,
                        owner_user_id_sales_order: null,
                        currency_code_sales_order: null,
                        transaction_date_sales_order: null,
                        list_price_sales_order: null,
                        net_sale_price_sales_order: null,
                        sale_price_sales_order: null,
                        advisor_commission_sales_order: null,
                        source_created_at_sales_order: null,
                        created_by_user_id_sales_order: null,
                        updated_by_user_id_sales_order: null,
                        deleted_at_sales_order: null,
                    })
                    .execute();
                const executor = tx.withPlugin({
                    transformQuery(args) {
                        if (failApproval && args.node.kind === "InsertQueryNode" && JSON.stringify(args.node.into).includes("audit_sales_order_approval_event")) throw new Error("forced audit failure");
                        return args.node;
                    },
                    transformResult: (args) => Promise.resolve(args.result),
                });
                const scoped = new Proxy(executor, {
                    get(target, property) {
                        if (property === "transaction")
                            return () => ({
                                execute: async (operation: (db: Kysely<CrmDatabase>) => Promise<unknown>) => {
                                    await sql`SAVEPOINT lifecycle_operation`.execute(tx);
                                    try {
                                        const result = await operation(scoped);
                                        await sql`RELEASE SAVEPOINT lifecycle_operation`.execute(tx);
                                        return result;
                                    } catch (error) {
                                        await sql`ROLLBACK TO SAVEPOINT lifecycle_operation`.execute(tx);
                                        throw error;
                                    }
                                },
                            });
                        const value: unknown = Reflect.get(target, property, target);
                        return typeof value === "function" ? (value.bind(target) as unknown) : value;
                    },
                });
                const service: DatabaseService = { db: scoped, onModuleDestroy: async () => {} };
                const context: LifecycleContext = { orderId, actor: { publicId: actor, name: "Lifecycle rollback actor", roles: [{ code: "test", name: "Rollback test" }] }, reason: "Real MySQL rollback verification", operationId: ulid(), correlationId: ulid() };
                await run(new SalesOrderLifecycleRepository(service), tx, context);
                throw rollback;
            });
        } catch (error) {
            if (error !== rollback) throw error;
        }
    }

    it("stores reentry, actor and dates; retries once and rejects stale writes", async () => {
        await fixture(async (repo, tx, context) => {
            const first = { ...context, state: "pending_approval", expectedSequence: 0 };
            expect(await repo.transition(first)).toBe(1);
            expect(await repo.transition(first)).toBe(1);
            await expect(repo.transition({ ...first, state: "bank_management" })).rejects.toThrow("otro contenido");
            await expect(repo.transition({ ...first, operationId: ulid() })).rejects.toThrow("actualice");
            expect(await repo.transition({ ...context, operationId: ulid(), state: "contract_pending_send", expectedSequence: 1 })).toBe(2);
            expect(await repo.transition({ ...context, operationId: ulid(), state: "pending_approval", expectedSequence: 2 })).toBe(3);
            const events = await tx.selectFrom("audit_sales_order_state_event").selectAll().where("correlation_id_sales_order_state_event", "=", context.correlationId).orderBy("sequence_sales_order_state_event").execute();
            expect(events.map((event) => event.from_state_code_sales_order_state_event)).toEqual([null, "pending_approval", "contract_pending_send"]);
            expect(events.map((event) => event.to_state_code_sales_order_state_event)).toEqual(["pending_approval", "contract_pending_send", "pending_approval"]);
            expect(events.every((event) => event.actor_user_id_sales_order_state_event !== null && event.effective_at_sales_order_state_event !== null)).toBe(true);
            const durations = await sql<{ seconds: number | null }>`SELECT TIMESTAMPDIFF(SECOND,effective_at_sales_order_state_event, LEAD(effective_at_sales_order_state_event) OVER (ORDER BY sequence_sales_order_state_event)) AS seconds FROM audit_sales_order_state_event WHERE correlation_id_sales_order_state_event=${context.correlationId}`.execute(tx);
            expect(durations.rows).toHaveLength(3);
            expect(durations.rows[0]?.seconds).toBeGreaterThanOrEqual(0);
            expect(durations.rows[2]?.seconds).toBeNull();
        });
    });

    it("records independent approvals with before/after and optimistic versions", async () => {
        await fixture(async (repo, tx, context) => {
            const input = { ...context, type: "developer", status: "approved" as const, expectedVersion: 0 };
            expect(await repo.recordApproval(input)).toBe(1);
            expect(await repo.recordApproval(input)).toBe(1);
            expect(await repo.recordApproval({ ...input, operationId: ulid(), status: "not_approved", expectedVersion: 1 })).toBe(2);
            await expect(repo.recordApproval({ ...input, operationId: ulid() })).rejects.toThrow("actualice");
            const rows = await tx.selectFrom("audit_sales_order_approval_event").selectAll().where("correlation_id_sales_order_approval_event", "=", context.correlationId).orderBy("version_sales_order_approval_event").execute();
            expect(rows.map((row) => [row.before_status_sales_order_approval_event, row.after_status_sales_order_approval_event])).toEqual([
                [null, "approved"],
                ["approved", "not_approved"],
            ]);
        });
    });

    it("does not change the approval projection when audit fails", async () => {
        await fixture(async (repo, tx, context) => {
            await expect(repo.recordApproval({ ...context, type: "formalization", status: "approved", expectedVersion: 0 })).rejects.toThrow("forced audit failure");
            const events = await tx.selectFrom("audit_sales_order_approval_event").select("id_sales_order_approval_event").where("correlation_id_sales_order_approval_event", "=", context.correlationId).execute();
            expect(events).toEqual([]);
            const rows = await tx
                .selectFrom("crm_sales_order_approval")
                .selectAll()
                .where("sales_order_id_sales_order_approval", "=", tx.selectFrom("crm_sales_order").select("id_sales_order").where("public_id_sales_order", "=", context.orderId))
                .execute();
            expect(rows).toEqual([]);
        }, true);
    });

    it("keeps imported initial dates unknown and enforces state references", async () => {
        await fixture(async (repo, tx, context) => {
            const order = await tx.selectFrom("crm_sales_order").select("id_sales_order").where("public_id_sales_order", "=", context.orderId).executeTakeFirstOrThrow();
            await tx
                .insertInto("audit_sales_order_state_event")
                .values({
                    public_id_sales_order_state_event: ulid(),
                    sales_order_id_sales_order_state_event: order.id_sales_order,
                    sequence_sales_order_state_event: 1,
                    from_state_code_sales_order_state_event: null,
                    to_state_code_sales_order_state_event: "unclassified",
                    event_kind_sales_order_state_event: "import_snapshot",
                    effective_at_sales_order_state_event: null,
                    actor_user_id_sales_order_state_event: null,
                    actor_snapshot_sales_order_state_event: null,
                    origin_sales_order_state_event: "legacy_import",
                    reason_sales_order_state_event: "Estado observado; no existe evidencia historica",
                    operation_id_sales_order_state_event: context.operationId,
                    correlation_id_sales_order_state_event: context.correlationId,
                })
                .execute();
            const event = await tx.selectFrom("audit_sales_order_state_event").selectAll().where("operation_id_sales_order_state_event", "=", context.operationId).executeTakeFirstOrThrow();
            expect(event.effective_at_sales_order_state_event).toBeNull();
            expect(event.actor_user_id_sales_order_state_event).toBeNull();
            expect(event.recorded_at_sales_order_state_event).toBeInstanceOf(Date);
            const defaults = await sql<{ offsetSeconds: number }>`SELECT ABS(TIMESTAMPDIFF(SECOND,recorded_at_sales_order_state_event,UTC_TIMESTAMP(3))) AS offsetSeconds FROM audit_sales_order_state_event WHERE operation_id_sales_order_state_event=${context.operationId}`.execute(tx);
            expect(Number(defaults.rows[0]?.offsetSeconds)).toBeLessThan(10);
            await expect(repo.transition({ ...context, operationId: ulid(), state: "does_not_exist", expectedSequence: 1 })).rejects.toThrow("foreign key constraint fails");
        });
    });

    it("rejects inactive and cancelled orders without adding history", async () => {
        await fixture(async (repo, tx, context) => {
            await tx.updateTable("crm_sales_order").set({ cancelled_sales_order: "yes" }).where("public_id_sales_order", "=", context.orderId).execute();
            await expect(repo.transition({ ...context, state: "pending_approval", expectedSequence: 0 })).rejects.toThrow("caida");
            await tx.updateTable("crm_sales_order").set({ cancelled_sales_order: "no", status_sales_order: "inactive" }).where("public_id_sales_order", "=", context.orderId).execute();
            await expect(repo.recordApproval({ ...context, type: "developer", status: "approved", expectedVersion: 0 })).rejects.toThrow("activa");
        });
    });

    it("keeps provider IDs independent while preventing duplicate references", async () => {
        await fixture(async (_repo, tx, context) => {
            const order = await tx.selectFrom("crm_sales_order").select("id_sales_order").where("public_id_sales_order", "=", context.orderId).executeTakeFirstOrThrow();
            for (const suffix of ["a", "b"]) {
                const code = `fixture-${context.orderId}-${suffix}`;
                await tx.insertInto("int_external_system").values({ code_external_system: code, name_external_system: "Rollback provider", status_external_system: "active", created_at_external_system: new Date(), updated_at_external_system: new Date() }).execute();
                const system = await tx.selectFrom("int_external_system").select("id_external_system").where("code_external_system", "=", code).executeTakeFirstOrThrow();
                const reference = { sales_order_id_sales_order_external_reference: order.id_sales_order, external_system_id_sales_order_external_reference: system.id_external_system, external_id_sales_order_external_reference: "same-provider-record-id", transaction_number_sales_order_external_reference: "VISIBLE-42" };
                await tx.insertInto("crm_sales_order_external_reference").values(reference).execute();
                await expect(tx.insertInto("crm_sales_order_external_reference").values(reference).execute()).rejects.toThrow();
            }
            expect(await tx.selectFrom("crm_sales_order_external_reference").selectAll().where("sales_order_id_sales_order_external_reference", "=", order.id_sales_order).execute()).toHaveLength(2);
        });
    });
});
