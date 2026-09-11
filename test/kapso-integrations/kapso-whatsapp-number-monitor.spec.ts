import { createKapsoWhatsappNumberMonitorRows, formatKapsoWhatsappNumberMonitorRows } from "../../src/kapso-integrations/kapso-whatsapp-number-monitor";

const now = new Date("2026-09-03T21:48:21.000Z");

type MonitorSnapshot = Parameters<typeof createKapsoWhatsappNumberMonitorRows>[0][number];

const createIntegration = (overrides: Partial<MonitorSnapshot> = {}): MonitorSnapshot => ({
    businessAccountId: "3174045732780123",
    businessName: "RDG Ventas",
    connectedAt: now,
    createdAt: now,
    displayPhoneNumber: "+506 7045 2242",
    id: BigInt(1),
    idnetsuiteAdminAsignado: null,
    isActive: true,
    kapsoCustomerId: "7ef8bba6-d140-4b57-a74f-3757f601b9a9",
    kapsoPhoneNumberId: "1197677976762773",
    kapsoProjectId: "8067127b-c559-44ef-9f84-f20270911eec",
    lastSyncAt: null,
    phoneNumber: "50670452242",
    status: "created",
    ultimoPayloadKapso: {
        customer: { id: "customer-1" },
        phone_number_id: "1197677976762773",
        project: { id: "project-1" },
    },
    updatedAt: now,
    ...overrides,
});

describe("Kapso WhatsApp number monitor presenter", () => {
    it("serializes rows for CLI output without BigInt or Date objects", () => {
        const result = createKapsoWhatsappNumberMonitorRows([createIntegration()]);

        expect(result).toEqual([
            {
                businessAccountId: "3174********0123",
                businessName: "RDG Ventas",
                connectedAt: "2026-09-03T21:48:21.000Z",
                createdAt: "2026-09-03T21:48:21.000Z",
                displayPhoneNumber: "+506******2242",
                id: "1",
                idnetsuiteAdminAsignado: null,
                isActive: true,
                kapsoCustomerId: "7ef8bba6-d140-4b57-a74f-3757f601b9a9",
                kapsoPhoneNumberId: "1197677976762773",
                kapsoProjectId: "8067127b-c559-44ef-9f84-f20270911eec",
                lastSyncAt: null,
                payloadKeys: ["customer", "phone_number_id", "project"],
                phoneNumber: "5067***2242",
                status: "created",
                updatedAt: "2026-09-03T21:48:21.000Z",
            },
        ]);
    });

    it("returns an empty array when the table has no rows", () => {
        expect(createKapsoWhatsappNumberMonitorRows([])).toEqual([]);
    });

    it("handles missing optional fields and non-object payloads safely", () => {
        const result = createKapsoWhatsappNumberMonitorRows([
            createIntegration({
                businessAccountId: null,
                businessName: null,
                displayPhoneNumber: null,
                lastSyncAt: now,
                phoneNumber: null,
                ultimoPayloadKapso: ["unexpected"],
            }),
        ]);

        expect(result[0]).toEqual(
            expect.objectContaining({
                businessAccountId: null,
                businessName: null,
                displayPhoneNumber: null,
                lastSyncAt: "2026-09-03T21:48:21.000Z",
                payloadKeys: [],
                phoneNumber: null,
            }),
        );
    });

    it("prints compact JSON with total and sanitized rows", () => {
        const output = formatKapsoWhatsappNumberMonitorRows([createIntegration()]);
        const parsed = JSON.parse(output) as { total: number; data: unknown[] };

        expect(parsed.total).toBe(1);
        expect(parsed.data).toHaveLength(1);
        expect(output).not.toContain("50670452242");
    });
});
