import { KapsoWhatsappNumberRepository } from '../src/kapso-integrations/kapso-whatsapp-number.repository';

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

const createPrismaMock = (): {
  kapsoIntegracionNumeroWhatsapp: {
    count: jest.Mock;
    deleteMany: jest.Mock;
    findMany: jest.Mock;
    updateMany: jest.Mock;
    upsert: jest.Mock;
  };
} => ({
  kapsoIntegracionNumeroWhatsapp: {
    count: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
    updateMany: jest.fn(),
    upsert: jest.fn(),
  },
});

const getLastMockArg = (mock: jest.Mock): unknown => {
  const calls = mock.mock.calls as readonly (readonly unknown[])[];

  return calls.at(-1)?.[0];
};

describe('KapsoWhatsappNumberRepository', () => {
  it('counts integrations without writing data', async () => {
    const prisma = createPrismaMock();
    prisma.kapsoIntegracionNumeroWhatsapp.count.mockResolvedValue(2);
    const repository = new KapsoWhatsappNumberRepository(prisma);

    await expect(repository.count()).resolves.toBe(2);
    expect(prisma.kapsoIntegracionNumeroWhatsapp.count).toHaveBeenCalledWith();
  });

  it('lists active integrations ordered by newest first', async () => {
    const prisma = createPrismaMock();
    prisma.kapsoIntegracionNumeroWhatsapp.findMany.mockResolvedValue([]);
    const repository = new KapsoWhatsappNumberRepository(prisma);

    await repository.findActive();

    expect(prisma.kapsoIntegracionNumeroWhatsapp.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      where: { isActive: true },
    });
  });

  it('lists all integrations ordered by newest first', async () => {
    const prisma = createPrismaMock();
    prisma.kapsoIntegracionNumeroWhatsapp.findMany.mockResolvedValue([]);
    const repository = new KapsoWhatsappNumberRepository(prisma);

    await repository.findAll();

    expect(prisma.kapsoIntegracionNumeroWhatsapp.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
    });
  });

  it('returns false when the table cannot be read', async () => {
    const prisma = createPrismaMock();
    prisma.kapsoIntegracionNumeroWhatsapp.count.mockRejectedValue(new Error('db offline'));
    const repository = new KapsoWhatsappNumberRepository(prisma);

    await expect(repository.canReadTable()).resolves.toBe(false);
  });

  it('upserts a created Kapso phone number integration', async () => {
    const prisma = createPrismaMock();
    prisma.kapsoIntegracionNumeroWhatsapp.upsert.mockResolvedValue({ id: BigInt(1) });
    const repository = new KapsoWhatsappNumberRepository(prisma);
    const rawPayload = { phone_number_id: '123456789012345' };

    await repository.upsertFromKapsoCreatedEvent({
      kapsoPhoneNumberId: '123456789012345',
      kapsoProjectId: 'project-1',
      kapsoCustomerId: 'customer-1',
      rawPayload,
    });

    const args = getLastMockArg(prisma.kapsoIntegracionNumeroWhatsapp.upsert) as
      UpsertArgsSnapshot | undefined;

    expect(args).toMatchObject({
      create: {
        isActive: true,
        kapsoCustomerId: 'customer-1',
        kapsoPhoneNumberId: '123456789012345',
        kapsoProjectId: 'project-1',
        status: 'created',
        ultimoPayloadKapso: rawPayload,
      },
      update: {
        isActive: true,
        kapsoCustomerId: 'customer-1',
        kapsoProjectId: 'project-1',
        status: 'created',
        ultimoPayloadKapso: rawPayload,
      },
      where: { kapsoPhoneNumberId: '123456789012345' },
    });
    expect(args?.create.connectedAt).toBeInstanceOf(Date);
  });

  it('upserts nullable project and customer values when Kapso omits them', async () => {
    const prisma = createPrismaMock();
    prisma.kapsoIntegracionNumeroWhatsapp.upsert.mockResolvedValue({ id: BigInt(1) });
    const repository = new KapsoWhatsappNumberRepository(prisma);

    await repository.upsertFromKapsoCreatedEvent({
      kapsoPhoneNumberId: '123456789012345',
      kapsoProjectId: undefined,
      kapsoCustomerId: undefined,
      rawPayload: { phone_number_id: '123456789012345' },
    });

    const args = getLastMockArg(prisma.kapsoIntegracionNumeroWhatsapp.upsert) as
      UpsertArgsSnapshot | undefined;

    expect(args?.create.kapsoCustomerId).toBeNull();
    expect(args?.create.kapsoProjectId).toBeNull();
    expect(args?.update.kapsoCustomerId).toBeNull();
    expect(args?.update.kapsoProjectId).toBeNull();
  });

  it('deletes an integration by Kapso phone number id', async () => {
    const prisma = createPrismaMock();
    prisma.kapsoIntegracionNumeroWhatsapp.deleteMany.mockResolvedValue({ count: 1 });
    const repository = new KapsoWhatsappNumberRepository(prisma);

    await expect(repository.deleteByKapsoPhoneNumberId('123456789012345')).resolves.toBe(1);

    expect(prisma.kapsoIntegracionNumeroWhatsapp.deleteMany).toHaveBeenCalledWith({
      where: { kapsoPhoneNumberId: '123456789012345' },
    });
  });

  it('returns zero when deleting a non-existing integration', async () => {
    const prisma = createPrismaMock();
    prisma.kapsoIntegracionNumeroWhatsapp.deleteMany.mockResolvedValue({ count: 0 });
    const repository = new KapsoWhatsappNumberRepository(prisma);

    await expect(repository.deleteByKapsoPhoneNumberId('missing')).resolves.toBe(0);
  });

  it('activates an integration by id', async () => {
    const prisma = createPrismaMock();
    prisma.kapsoIntegracionNumeroWhatsapp.updateMany.mockResolvedValue({ count: 1 });
    const repository = new KapsoWhatsappNumberRepository(prisma);

    await expect(repository.setActiveById(BigInt(1), true)).resolves.toBe(1);

    expect(prisma.kapsoIntegracionNumeroWhatsapp.updateMany).toHaveBeenCalledWith({
      data: { isActive: true },
      where: { id: BigInt(1) },
    });
  });

  it('deactivates an integration by id', async () => {
    const prisma = createPrismaMock();
    prisma.kapsoIntegracionNumeroWhatsapp.updateMany.mockResolvedValue({ count: 1 });
    const repository = new KapsoWhatsappNumberRepository(prisma);

    await expect(repository.setActiveById(BigInt(1), false)).resolves.toBe(1);

    expect(prisma.kapsoIntegracionNumeroWhatsapp.updateMany).toHaveBeenCalledWith({
      data: { isActive: false },
      where: { id: BigInt(1) },
    });
  });

  it('returns zero when no integration is updated by id', async () => {
    const prisma = createPrismaMock();
    prisma.kapsoIntegracionNumeroWhatsapp.updateMany.mockResolvedValue({ count: 0 });
    const repository = new KapsoWhatsappNumberRepository(prisma);

    await expect(repository.setActiveById(BigInt(999), true)).resolves.toBe(0);
  });
});
