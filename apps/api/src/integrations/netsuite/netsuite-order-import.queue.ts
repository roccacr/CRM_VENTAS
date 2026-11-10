import { createHash } from "node:crypto";

import { BadRequestException, HttpException, Inject, Injectable, type OnModuleDestroy, type OnModuleInit, ServiceUnavailableException } from "@nestjs/common";
import { sql } from "kysely";
import { ulid } from "ulid";
import { z } from "zod";

import { DatabaseService } from "../../database/database.service.js";
import { IdentityService } from "../../modules/crm/identity/identity.service.js";
import { NetsuiteOrderRepository } from "./netsuite-order.repository.js";
import { NetsuiteSalesOrderService } from "./netsuite-sales-order.service.js";

const type = "netsuite_order_import";
type OrderLink = { id: string; source: "native" | "legacy" };
const actorSchema = z.object({ user: z.object({ publicId: z.string(), permissionVersion: z.number() }), session: z.object({ publicId: z.string() }) });
const jobSchema = z.object({ tranid: z.string(), actor: actorSchema });
const numberSchema = z.strictObject({
    tranid: z
        .string()
        .trim()
        .regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,59}$/),
});

/**
 *
 */
@Injectable()
export class NetsuiteOrderImportQueue implements OnModuleInit, OnModuleDestroy {
    private timer?: ReturnType<typeof setInterval>;
    private busy = false;
    /**
     *
     */
    constructor(
        @Inject(DatabaseService) private readonly database: DatabaseService,
        @Inject(IdentityService) private readonly identity: IdentityService,
        @Inject(NetsuiteOrderRepository) private readonly repository: NetsuiteOrderRepository,
        @Inject(NetsuiteSalesOrderService) private readonly orders: NetsuiteSalesOrderService,
    ) {}
    /**
     *
     */
    onModuleInit() {
        this.timer = setInterval(() => {
            void this.tick();
        }, 5000);
        this.timer.unref();
    }
    /**
     *
     */
    onModuleDestroy() {
        clearInterval(this.timer);
    }
    /**
     *
     */
    async enqueue(session: string | undefined, body: unknown) {
        const parsed = numberSchema.safeParse(body);
        if (!parsed.success) throw new BadRequestException("Indica el número exacto de la orden.");
        const tranid = parsed.data.tranid.toUpperCase();
        const actor = actorSchema.parse(await this.identity.getCurrentUser(session));
        const key = createHash("sha256")
            .update(actor.user.publicId + ":" + tranid)
            .digest("hex")
            .slice(0, 26);
        const id = ulid();
        try {
            await sql`INSERT INTO int_event_outbox (public_id_event_outbox,aggregate_type_event_outbox,aggregate_public_id_event_outbox,aggregate_version_event_outbox,event_type_event_outbox,destination_code_event_outbox,payload_event_outbox)
            VALUES (${id},${type},${key},1,'import_requested','notification',${JSON.stringify({ tranid, actor })})
            ON DUPLICATE KEY UPDATE
            public_id_event_outbox=IF(status_event_outbox='failed',VALUES(public_id_event_outbox),public_id_event_outbox),
            payload_event_outbox=IF(status_event_outbox='failed',VALUES(payload_event_outbox),payload_event_outbox),
            attempts_event_outbox=IF(status_event_outbox='failed',0,attempts_event_outbox),
            available_at_event_outbox=IF(status_event_outbox='failed',UTC_TIMESTAMP(3),available_at_event_outbox),
            status_event_outbox=IF(status_event_outbox='failed','pending',status_event_outbox)`.execute(this.database.db);
        } catch {
            throw new ServiceUnavailableException("La cola de importación no está disponible.");
        }
        void this.tick();
        return { queued: true, tranid };
    }
    /**
     *
     */
    async notices(session: string | undefined) {
        const { user } = await this.identity.getCurrentUser(session);
        const { rows } = await sql<{ id: string; tranid: string; status: string; reason: string | null; read: number | string; orderId: string | null; orderSource: OrderLink["source"] | null }>`
            SELECT public_id_event_outbox AS id, JSON_UNQUOTE(JSON_EXTRACT(payload_event_outbox,'$.tranid')) AS tranid,
            status_event_outbox AS status, NULLIF(JSON_UNQUOTE(JSON_EXTRACT(payload_event_outbox,'$.resultReason')),'null') AS reason,
            NULLIF(JSON_UNQUOTE(JSON_EXTRACT(payload_event_outbox,'$.order.id')),'null') AS orderId,
            NULLIF(JSON_UNQUOTE(JSON_EXTRACT(payload_event_outbox,'$.order.source')),'null') AS orderSource,
            COALESCE(JSON_EXTRACT(payload_event_outbox,'$.read'),0) AS ${sql.id("read")}
            FROM int_event_outbox WHERE aggregate_type_event_outbox=${type}
            AND JSON_UNQUOTE(JSON_EXTRACT(payload_event_outbox,'$.actor.user.publicId'))=${user.publicId}
            ORDER BY updated_at_event_outbox DESC LIMIT 50`.execute(this.database.db);
        return rows.map((row) => ({ ...row, read: Number(row.read) === 1 }));
    }
    /**
     *
     */
    async markRead(session: string | undefined, id: string) {
        const { user } = await this.identity.getCurrentUser(session);
        await sql`UPDATE int_event_outbox SET payload_event_outbox=JSON_SET(payload_event_outbox,'$.read',1)
            WHERE public_id_event_outbox=${id} AND aggregate_type_event_outbox=${type}
            AND status_event_outbox IN ('delivered','failed')
            AND JSON_UNQUOTE(JSON_EXTRACT(payload_event_outbox,'$.actor.user.publicId'))=${user.publicId}`.execute(this.database.db);
        return { read: true };
    }
    private async tick() {
        if (this.busy) return;
        this.busy = true;
        try {
            const job = await this.claim();
            if (job) await this.run(job);
        } catch {
            // An uncommitted claim or an expired lease can be recovered by the next poll.
        } finally {
            this.busy = false;
        }
    }
    private async claim() {
        return this.database.db.transaction().execute(async (tx) => {
            const { rows } = await sql<{ id: string; attempt: number; payload: unknown }>`
                SELECT id_event_outbox AS id, attempts_event_outbox AS attempt, payload_event_outbox AS payload
                FROM int_event_outbox WHERE aggregate_type_event_outbox=${type} AND status_event_outbox IN ('pending','processing')
                AND available_at_event_outbox<=UTC_TIMESTAMP(3) ORDER BY id_event_outbox LIMIT 1 FOR UPDATE`.execute(tx);
            const row = rows[0];
            if (!row) return null;
            const attempt = row.attempt + 1;
            await sql`UPDATE int_event_outbox SET status_event_outbox='processing', attempts_event_outbox=${attempt},
                available_at_event_outbox=DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 5 MINUTE) WHERE id_event_outbox=${row.id}`.execute(tx);
            return { ...row, attempt };
        });
    }
    private async run(job: { id: string; attempt: number; payload: unknown }) {
        let order: OrderLink | null = null;
        let reason: string | null;
        let status = "delivered";
        try {
            const payload = jobSchema.parse(typeof job.payload === "string" ? JSON.parse(job.payload) : job.payload);
            await this.database.db.transaction().execute((tx) => this.repository.captureSynchronizationActor(tx, payload.actor));
            const outcome = await this.importOrFind(payload);
            order = outcome.order;
            reason = outcome.warning ?? null;
        } catch (error) {
            status = "failed";
            reason = error instanceof HttpException ? error.message.slice(0, 240) : "Error interno al importar la orden.";
        }
        await sql`UPDATE int_event_outbox SET status_event_outbox=${status},last_error_code_event_outbox=${status === "failed" ? "order_import_failed" : null},
            payload_event_outbox=JSON_SET(payload_event_outbox,'$.order',JSON_EXTRACT(${JSON.stringify(order)},'$'),'$.resultReason',JSON_EXTRACT(${JSON.stringify(reason)},'$')),
            updated_at_event_outbox=UTC_TIMESTAMP(3) WHERE id_event_outbox=${job.id} AND attempts_event_outbox=${job.attempt}`.execute(this.database.db);
    }
    private async importOrFind(payload: z.infer<typeof jobSchema>) {
        const existing = await this.findExisting(payload.tranid);
        if (existing) return { order: existing };
        let warning: string | undefined;
        try {
            const imported = await this.orders.executeQueuedImport(payload.tranid, payload.actor);
            warning = imported.warning;
        } catch (error) {
            const concurrent = await this.findExisting(payload.tranid);
            if (!concurrent) throw error;
            return { order: concurrent };
        }
        const order = await this.findExisting(payload.tranid);
        if (!order) throw new ServiceUnavailableException("La orden no quedó disponible después de la importación.");
        return { order, warning };
    }

    private async findExisting(tranid: string): Promise<OrderLink | null> {
        const { rows } = await sql<OrderLink>`
            SELECT CONVERT(o.public_id_sales_order USING utf8mb4) COLLATE utf8mb4_unicode_ci AS id,'native' AS source
            FROM crm_sales_order o JOIN crm_sales_order_external_reference r ON r.sales_order_id_sales_order_external_reference=o.id_sales_order
            JOIN int_external_system s ON s.id_external_system=r.external_system_id_sales_order_external_reference
            WHERE s.code_external_system='netsuite' AND s.status_external_system='active' AND r.status_sales_order_external_reference='active'
            AND r.transaction_number_sales_order_external_reference=${tranid} AND o.deleted_at_sales_order IS NULL
            UNION ALL
            SELECT CAST(v.id_ov AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci,'legacy' FROM ${sql.table("crmdatabase-api.ordenventa")} v
            WHERE v.id_ov_tranid=${tranid} AND NOT EXISTS (SELECT 1 FROM crm_sales_order o WHERE o.id_old_produccion_sales_order=v.id_ov)
            LIMIT 2`.execute(this.database.db);
        if (rows.length > 1) throw new BadRequestException("El número de orden tiene más de una coincidencia en Habita.");
        return rows[0] ?? null;
    }
}
