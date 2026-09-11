import { KapsoIntegracionNumeroWhatsapp } from "@prisma/client";

type MonitorRowInput = Pick<KapsoIntegracionNumeroWhatsapp, "businessAccountId" | "businessName" | "connectedAt" | "createdAt" | "displayPhoneNumber" | "id" | "idnetsuiteAdminAsignado" | "isActive" | "kapsoCustomerId" | "kapsoPhoneNumberId" | "kapsoProjectId" | "lastSyncAt" | "phoneNumber" | "status" | "ultimoPayloadKapso" | "updatedAt">;

type MonitorRow = {
    readonly businessAccountId: string | null;
    readonly businessName: string | null;
    readonly connectedAt: string;
    readonly createdAt: string;
    readonly displayPhoneNumber: string | null;
    readonly id: string;
    readonly idnetsuiteAdminAsignado: number | null;
    readonly isActive: boolean;
    readonly kapsoCustomerId: string | null;
    readonly kapsoPhoneNumberId: string;
    readonly kapsoProjectId: string | null;
    readonly lastSyncAt: string | null;
    readonly payloadKeys: string[];
    readonly phoneNumber: string | null;
    readonly status: string;
    readonly updatedAt: string;
};

type MonitorOutput = {
    readonly total: number;
    readonly data: MonitorRow[];
};

/**
 * Presenter seguro para CLI: muestra estado operativo sin imprimir payload
 * crudo ni numeros completos. `payloadKeys` deja auditar el shape sin el secreto.
 */
export function createKapsoWhatsappNumberMonitorRows(rows: MonitorRowInput[]): MonitorRow[] {
    return rows.map((row) => ({
        businessAccountId: maskValue(row.businessAccountId),
        businessName: row.businessName,
        connectedAt: row.connectedAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
        displayPhoneNumber: maskValue(row.displayPhoneNumber),
        id: row.id.toString(),
        idnetsuiteAdminAsignado: row.idnetsuiteAdminAsignado,
        isActive: row.isActive,
        kapsoCustomerId: row.kapsoCustomerId,
        kapsoPhoneNumberId: row.kapsoPhoneNumberId,
        kapsoProjectId: row.kapsoProjectId,
        lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
        payloadKeys: getPayloadKeys(row.ultimoPayloadKapso),
        phoneNumber: maskValue(row.phoneNumber),
        status: row.status,
        updatedAt: row.updatedAt.toISOString(),
    }));
}

export function formatKapsoWhatsappNumberMonitorRows(rows: MonitorRowInput[]): string {
    const data = createKapsoWhatsappNumberMonitorRows(rows);
    const output: MonitorOutput = { data, total: data.length };
    return JSON.stringify(output, null, 2);
}

function getPayloadKeys(payload: unknown): string[] {
    if (!payload || Array.isArray(payload) || typeof payload !== "object") {
        return [];
    }

    return Object.keys(payload).sort();
}

function maskValue(value: string | null): string | null {
    if (!value) {
        return value;
    }

    const visibleStart = Math.min(4, value.length);
    const visibleEnd = Math.min(4, Math.max(value.length - visibleStart, 0));
    const hiddenLength = Math.max(value.length - visibleStart - visibleEnd, 0);

    if (hiddenLength === 0) {
        return value;
    }

    return `${value.slice(0, visibleStart)}${"*".repeat(hiddenLength)}${value.slice(-visibleEnd)}`;
}
