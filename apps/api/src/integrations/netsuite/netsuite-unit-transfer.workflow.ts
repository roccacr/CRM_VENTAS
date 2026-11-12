import { BadGatewayException, ConflictException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { sql, type Transaction } from "kysely";
import { ulid } from "ulid";

import { DatabaseService } from "../../database/database.service.js";
import type { CrmDatabase } from "../../database/database.types.js";
import { FORMALIZATION_APPROVAL_LEGACY, type FormalizationApprovalLegacy } from "../../modules/crm/sales/sales-orders/formalization-approval.port.js";
import type { UnitTransferWorkflow } from "../../modules/crm/sales/sales-orders/unit-transfer-workflow.port.js";
import { NetsuiteRestletClient } from "./netsuite-restlet.client.js";

const ACTION = "unit_transferred_from_habita";
const RECONCILE = "La etapa no fue guardada. El flujo NetSuite tiene un resultado pendiente o desconocido; requiere conciliación antes de reintentar.";

/** La reserva se confirma en otra conexión ANTES del PUT. Un timeout o rollback nunca habilita otro envío. */
@Injectable()
export class NetsuiteUnitTransferWorkflow implements UnitTransferWorkflow {
    /** Usa el pool canónico y los adaptadores ya autorizados. */
    constructor(
        @Inject(DatabaseService) private readonly database: DatabaseService,
        @Inject(NetsuiteRestletClient) private readonly client: NetsuiteRestletClient,
        @Inject(FORMALIZATION_APPROVAL_LEGACY) private readonly legacy: FormalizationApprovalLegacy,
    ) {}

    /** Devuelve evidencia persistida; nunca vuelve a enviar un intento incierto. */
    async execute(tx: Transaction<CrmDatabase>, command: Parameters<UnitTransferWorkflow["execute"]>[1]): Promise<string> {
        const externalId = await this.reference(tx, command);
        const { environment } = this.client.integrationContext();
        const attempt = ulid();
        const previous = await this.reserve(externalId, environment, attempt, command);
        if (previous !== null) return previous;
        try {
            const confirmation = await this.client.transferUnit(externalId);
            if (confirmation.environment !== environment) throw new Error("environment_changed");
            const result = `Flujo para Unidad traspasada desde Habita: customworkflow220 / workflowstate2780; confirmado en ${environment}; instancia ${confirmation.instanceId}; ejecución ${attempt}.`;
            await sql`UPDATE int_order_workflow_execution SET status_order_workflow_execution='confirmed',
                result_order_workflow_execution=${result},updated_at_order_workflow_execution=UTC_TIMESTAMP(3)
                WHERE id_order_workflow_execution=${attempt}`.execute(this.database.db);
            return result;
        } catch {
            // Incluso un rechazo se concilia: no suponemos que un error de transporte implique ausencia de efectos.
            await sql`UPDATE int_order_workflow_execution SET status_order_workflow_execution='unknown',
                result_order_workflow_execution='Resultado no confirmado; no repetir sin conciliacion',updated_at_order_workflow_execution=UTC_TIMESTAMP(3)
                WHERE id_order_workflow_execution=${attempt}`
                .execute(this.database.db)
                .catch(() => undefined);
            throw new BadGatewayException({ code: "UNIT_TRANSFER_RECONCILIATION_REQUIRED", message: RECONCILE });
        }
    }

    private async reserve(externalId: string, environment: string, attempt: string, command: Parameters<UnitTransferWorkflow["execute"]>[1]): Promise<string | null> {
        // Sin FK ni escritura en la orden: evita esperar el bloqueo que conserva la transacción del estado.
        // Una tabla ausente o un error de persistencia impiden llamar al proveedor.
        try {
            await sql`INSERT INTO int_order_workflow_execution
                (id_order_workflow_execution,environment_order_workflow_execution,external_id_order_workflow_execution,action_order_workflow_execution,
                 actor_order_workflow_execution,operation_order_workflow_execution,correlation_order_workflow_execution,status_order_workflow_execution)
                VALUES (${attempt},${environment},${externalId},${ACTION},${command.actorPublicId},${command.operationId},${command.correlationId},'pending')
                ON DUPLICATE KEY UPDATE id_order_workflow_execution=id_order_workflow_execution`.execute(this.database.db);
        } catch {
            throw new ServiceUnavailableException({ code: "UNIT_TRANSFER_UNAVAILABLE", message: "No se pudo reservar el flujo NetSuite. La etapa no fue guardada; revise la migración 077 y la conexión de auditoría." });
        }
        const { rows } = await sql<{ id: string; status: string; result: string | null }>`SELECT id_order_workflow_execution AS id,
            status_order_workflow_execution AS status,result_order_workflow_execution AS result FROM int_order_workflow_execution
            WHERE environment_order_workflow_execution=${environment} AND external_id_order_workflow_execution=${externalId}
            AND action_order_workflow_execution=${ACTION}`.execute(this.database.db);
        const previous = rows[0];
        if (previous?.status === "confirmed" && previous.result) return previous.result;
        if (previous?.id !== attempt) throw new ConflictException({ code: "UNIT_TRANSFER_RECONCILIATION_REQUIRED", message: RECONCILE });
        return null;
    }

    private async reference(tx: Transaction<CrmDatabase>, command: { source: "native" | "legacy"; id: string }): Promise<string> {
        let id: string | undefined;
        if (command.source === "legacy") id = (await this.legacy.lockApproval(tx, command.id))?.netsuiteId;
        else {
            const refs = await tx
                .selectFrom("crm_sales_order_external_reference as x")
                .innerJoin("int_external_system as s", "s.id_external_system", "x.external_system_id_sales_order_external_reference")
                .select("x.external_id_sales_order_external_reference as id")
                .where("x.sales_order_id_sales_order_external_reference", "=", Number(command.id))
                .where("s.code_external_system", "=", "netsuite")
                .where("s.status_external_system", "=", "active")
                .where("x.status_sales_order_external_reference", "=", "active")
                .limit(2)
                .forUpdate()
                .execute();
            if (refs.length === 1) id = refs[0]?.id;
        }
        if (!id || !/^[1-9][0-9]*$/.test(id) || !Number.isSafeInteger(Number(id))) throw new ConflictException({ code: "UNIT_TRANSFER_REFERENCE_REQUIRED", message: "Referencia NetSuite ausente, inválida o ambigua. La etapa no fue guardada." });
        return id;
    }
}
