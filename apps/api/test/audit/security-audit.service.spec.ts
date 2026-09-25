import { describe, expect, it } from "vitest";

import type { DatabaseService } from "../../src/database/database.service.js";
import { SECURITY_AUDIT_IP_ADDRESS_MAX_LENGTH, SECURITY_AUDIT_USER_AGENT_MAX_LENGTH, SecurityAuditService } from "../../src/modules/crm/audit/security-audit.service.js";

type AuditInsertRow = {
    ip_address_security_event: string | null;
    user_agent_security_event: string | null;
} & Record<string, unknown>;

/**
 * Crea un doble minimo de Kysely para capturar la fila de auditoria.
 *
 * La prueba no valida MySQL; valida que el servicio respete el contrato fisico
 * de columnas antes de entregar el payload al driver.
 */
const createDatabaseDouble = () => {
    let insertedRow: AuditInsertRow | null = null;

    const builder = {
        values: (row: AuditInsertRow) => {
            insertedRow = row;
            return builder;
        },
        execute: () => Promise.resolve(),
    };

    const database = {
        db: {
            insertInto: () => builder,
        },
    } as unknown as DatabaseService;

    return {
        database,
        readInsertedRow: () => insertedRow,
    };
};

describe("SecurityAuditService", () => {
    it("recorta IP y User-Agent al largo fisico de la tabla de auditoria", async () => {
        const { database, readInsertedRow } = createDatabaseDouble();
        const service = new SecurityAuditService(database);
        const longIpAddress = "1".repeat(SECURITY_AUDIT_IP_ADDRESS_MAX_LENGTH + 10);
        const longUserAgent = "A".repeat(SECURITY_AUDIT_USER_AGENT_MAX_LENGTH + 10);

        await service.record({
            eventType: "test.event",
            summary: "Evento de prueba",
            ipAddress: longIpAddress,
            userAgent: longUserAgent,
        });

        expect(readInsertedRow()?.ip_address_security_event).toHaveLength(SECURITY_AUDIT_IP_ADDRESS_MAX_LENGTH);
        expect(readInsertedRow()?.user_agent_security_event).toHaveLength(SECURITY_AUDIT_USER_AGENT_MAX_LENGTH);
    });
});
