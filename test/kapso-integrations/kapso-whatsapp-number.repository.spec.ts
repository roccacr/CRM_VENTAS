import { KapsoWhatsappNumberRepository } from "../../src/kapso-integrations/kapso-whatsapp-number.repository";
import { getLastMockArg } from "../common/jest/mock-utils";
import { TEST_CUSTOMER_ID, TEST_PHONE_NUMBER_ID, TEST_PROJECT_ID } from "../common/kapso/fixtures";
import { createKapsoPrismaMock } from "../common/kapso/prisma-mock";

type UpsertArgsSnapshot = {
    readonly create: {
        readonly connectedAt: unknown;
        readonly isActive: boolean;
        readonly kapsoCustomerId: string | null;
        readonly kapsoPhoneNumberId: string;
        readonly kapsoProjectId: string | null;
        readonly status: string;
        readonly ultimoPayloadKapso: unknown;
    };
    readonly update: {
        readonly isActive: boolean;
        readonly kapsoCustomerId: string | null;
        readonly kapsoProjectId: string | null;
        readonly status: string;
        readonly ultimoPayloadKapso: unknown;
    };
    readonly where: {
        readonly kapsoPhoneNumberId: string;
    };
};

describe("KapsoWhatsappNumberRepository", () => {
    it("counts integrations without writing data", async () => {
        const prisma = createKapsoPrismaMock();
        prisma.kapsoIntegracionNumeroWhatsapp.count.mockResolvedValue(2);
        const repository = new KapsoWhatsappNumberRepository(prisma);

        await expect(repository.count()).resolves.toBe(2);
        expect(prisma.kapsoIntegracionNumeroWhatsapp.count).toHaveBeenCalledWith();
    });

    it("lists active integrations ordered by newest first", async () => {
        const prisma = createKapsoPrismaMock();
        prisma.kapsoIntegracionNumeroWhatsapp.findMany.mockResolvedValue([]);
        const repository = new KapsoWhatsappNumberRepository(prisma);

        await repository.findActive();

        expect(prisma.kapsoIntegracionNumeroWhatsapp.findMany).toHaveBeenCalledWith({
            orderBy: { createdAt: "desc" },
            where: { isActive: true },
        });
    });

    it("lists all integrations ordered by newest first", async () => {
        const prisma = createKapsoPrismaMock();
        prisma.kapsoIntegracionNumeroWhatsapp.findMany.mockResolvedValue([]);
        const repository = new KapsoWhatsappNumberRepository(prisma);

        await repository.findAll();

        expect(prisma.kapsoIntegracionNumeroWhatsapp.findMany).toHaveBeenCalledWith({
            orderBy: { createdAt: "desc" },
        });
    });

    it("finds one integration by local id", async () => {
        const prisma = createKapsoPrismaMock();
        prisma.kapsoIntegracionNumeroWhatsapp.findUnique.mockResolvedValue({ id: BigInt(1) });
        const repository = new KapsoWhatsappNumberRepository(prisma);

        await expect(repository.findById(BigInt(1))).resolves.toEqual({ id: BigInt(1) });

        expect(prisma.kapsoIntegracionNumeroWhatsapp.findUnique).toHaveBeenCalledWith({
            where: { id: BigInt(1) },
        });
    });

    it("returns false when the table cannot be read", async () => {
        const prisma = createKapsoPrismaMock();
        prisma.kapsoIntegracionNumeroWhatsapp.count.mockRejectedValue(new Error("db offline"));
        const repository = new KapsoWhatsappNumberRepository(prisma);

        await expect(repository.canReadTable()).resolves.toBe(false);
    });

    it("upserts a created Kapso phone number integration", async () => {
        const prisma = createKapsoPrismaMock();
        prisma.kapsoIntegracionNumeroWhatsapp.upsert.mockResolvedValue({ id: BigInt(1) });
        const repository = new KapsoWhatsappNumberRepository(prisma);
        const rawPayload = { phone_number_id: TEST_PHONE_NUMBER_ID };

        await repository.upsertFromKapsoCreatedEvent({
            kapsoPhoneNumberId: TEST_PHONE_NUMBER_ID,
            kapsoProjectId: TEST_PROJECT_ID,
            kapsoCustomerId: TEST_CUSTOMER_ID,
            rawPayload,
        });

        const args = getLastMockArg(prisma.kapsoIntegracionNumeroWhatsapp.upsert) as UpsertArgsSnapshot | undefined;

        expect(args).toMatchObject({
            create: {
                isActive: true,
                kapsoCustomerId: TEST_CUSTOMER_ID,
                kapsoPhoneNumberId: TEST_PHONE_NUMBER_ID,
                kapsoProjectId: TEST_PROJECT_ID,
                status: "created",
                ultimoPayloadKapso: rawPayload,
            },
            update: {
                isActive: true,
                kapsoCustomerId: TEST_CUSTOMER_ID,
                kapsoProjectId: TEST_PROJECT_ID,
                status: "created",
                ultimoPayloadKapso: rawPayload,
            },
            where: { kapsoPhoneNumberId: TEST_PHONE_NUMBER_ID },
        });
        expect(args?.create.connectedAt).toBeInstanceOf(Date);
    });

    it("upserts nullable project and customer values when Kapso omits them", async () => {
        const prisma = createKapsoPrismaMock();
        prisma.kapsoIntegracionNumeroWhatsapp.upsert.mockResolvedValue({ id: BigInt(1) });
        const repository = new KapsoWhatsappNumberRepository(prisma);

        await repository.upsertFromKapsoCreatedEvent({
            kapsoPhoneNumberId: TEST_PHONE_NUMBER_ID,
            kapsoProjectId: undefined,
            kapsoCustomerId: undefined,
            rawPayload: { phone_number_id: TEST_PHONE_NUMBER_ID },
        });

        const args = getLastMockArg(prisma.kapsoIntegracionNumeroWhatsapp.upsert) as UpsertArgsSnapshot | undefined;

        expect(args?.create.kapsoCustomerId).toBeNull();
        expect(args?.create.kapsoProjectId).toBeNull();
        expect(args?.update.kapsoCustomerId).toBeNull();
        expect(args?.update.kapsoProjectId).toBeNull();
    });

    it("upserts phone number details from Kapso platform sync", async () => {
        const prisma = createKapsoPrismaMock();
        prisma.kapsoIntegracionNumeroWhatsapp.upsert.mockResolvedValue({ id: BigInt(1) });
        const repository = new KapsoWhatsappNumberRepository(prisma);
        const rawPayload = { phone_number_id: TEST_PHONE_NUMBER_ID, status: "CONNECTED" };

        await repository.upsertFromKapsoPhoneNumber({
            businessAccountId: "98765432109",
            businessName: "Acme Corp",
            displayPhoneNumber: "+1 555-123-4567",
            kapsoCustomerId: TEST_CUSTOMER_ID,
            kapsoPhoneNumberId: TEST_PHONE_NUMBER_ID,
            phoneNumber: "15551234567",
            rawPayload,
            status: "CONNECTED",
        });

        const args = getLastMockArg(prisma.kapsoIntegracionNumeroWhatsapp.upsert) as
            | (UpsertArgsSnapshot & {
                  readonly create: UpsertArgsSnapshot["create"] & {
                      readonly businessAccountId: string;
                      readonly displayPhoneNumber: string;
                      readonly lastSyncAt: unknown;
                      readonly phoneNumber: string;
                  };
                  readonly update: UpsertArgsSnapshot["update"] & {
                      readonly businessAccountId: string;
                      readonly displayPhoneNumber: string;
                      readonly lastSyncAt: unknown;
                      readonly phoneNumber: string;
                  };
              })
            | undefined;

        expect(args).toMatchObject({
            create: {
                businessAccountId: "98765432109",
                displayPhoneNumber: "+1 555-123-4567",
                isActive: true,
                phoneNumber: "15551234567",
                status: "CONNECTED",
            },
            update: {
                businessAccountId: "98765432109",
                displayPhoneNumber: "+1 555-123-4567",
                isActive: true,
                phoneNumber: "15551234567",
                status: "CONNECTED",
            },
            where: { kapsoPhoneNumberId: TEST_PHONE_NUMBER_ID },
        });
        expect(args?.create.lastSyncAt).toBeInstanceOf(Date);
        expect(args?.update.lastSyncAt).toBeInstanceOf(Date);
    });

    it("deletes an integration by Kapso phone number id", async () => {
        const prisma = createKapsoPrismaMock();
        prisma.kapsoIntegracionNumeroWhatsapp.deleteMany.mockResolvedValue({ count: 1 });
        const repository = new KapsoWhatsappNumberRepository(prisma);

        await expect(repository.deleteByKapsoPhoneNumberId(TEST_PHONE_NUMBER_ID)).resolves.toBe(1);

        expect(prisma.kapsoIntegracionNumeroWhatsapp.deleteMany).toHaveBeenCalledWith({
            where: { kapsoPhoneNumberId: TEST_PHONE_NUMBER_ID },
        });
    });

    it("returns zero when deleting a non-existing integration", async () => {
        const prisma = createKapsoPrismaMock();
        prisma.kapsoIntegracionNumeroWhatsapp.deleteMany.mockResolvedValue({ count: 0 });
        const repository = new KapsoWhatsappNumberRepository(prisma);

        await expect(repository.deleteByKapsoPhoneNumberId("missing")).resolves.toBe(0);
    });

    it("activates an integration by id", async () => {
        const prisma = createKapsoPrismaMock();
        prisma.kapsoIntegracionNumeroWhatsapp.updateMany.mockResolvedValue({ count: 1 });
        const repository = new KapsoWhatsappNumberRepository(prisma);

        await expect(repository.setActiveById(BigInt(1), true)).resolves.toBe(1);

        expect(prisma.kapsoIntegracionNumeroWhatsapp.updateMany).toHaveBeenCalledWith({
            data: { isActive: true },
            where: { id: BigInt(1) },
        });
    });

    it("deactivates an integration by id", async () => {
        const prisma = createKapsoPrismaMock();
        prisma.kapsoIntegracionNumeroWhatsapp.updateMany.mockResolvedValue({ count: 1 });
        const repository = new KapsoWhatsappNumberRepository(prisma);

        await expect(repository.setActiveById(BigInt(1), false)).resolves.toBe(1);

        expect(prisma.kapsoIntegracionNumeroWhatsapp.updateMany).toHaveBeenCalledWith({
            data: { isActive: false },
            where: { id: BigInt(1) },
        });
    });

    it("returns zero when no integration is updated by id", async () => {
        const prisma = createKapsoPrismaMock();
        prisma.kapsoIntegracionNumeroWhatsapp.updateMany.mockResolvedValue({ count: 0 });
        const repository = new KapsoWhatsappNumberRepository(prisma);

        await expect(repository.setActiveById(BigInt(999), true)).resolves.toBe(0);
    });
});
