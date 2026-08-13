import { NotFoundException } from '@nestjs/common';

import { KapsoWhatsappNumbersService } from '../src/kapso-integrations/kapso-whatsapp-numbers.service';

const now = new Date('2026-08-13T21:00:00.000Z');

type IntegrationSnapshot = {
  businessAccountId: null;
  businessName: null;
  connectedAt: Date;
  createdAt: Date;
  displayPhoneNumber: null;
  id: bigint;
  idnetsuiteAdminAsignado: null;
  isActive: boolean;
  kapsoCustomerId: string;
  kapsoPhoneNumberId: string;
  kapsoProjectId: string;
  lastSyncAt: null;
  phoneNumber: null;
  status: string;
  ultimoPayloadKapso: null;
  updatedAt: Date;
};

const createIntegration = (overrides: Partial<IntegrationSnapshot> = {}): IntegrationSnapshot => ({
  businessAccountId: null,
  businessName: null,
  connectedAt: now,
  createdAt: now,
  displayPhoneNumber: null,
  id: BigInt(1),
  idnetsuiteAdminAsignado: null,
  isActive: true,
  kapsoCustomerId: 'customer-1',
  kapsoPhoneNumberId: 'phone-1',
  kapsoProjectId: 'project-1',
  lastSyncAt: null,
  phoneNumber: null,
  status: 'created',
  ultimoPayloadKapso: null,
  updatedAt: now,
  ...overrides,
});

type RepositoryMock = {
  readonly findAll: jest.MockedFunction<() => Promise<IntegrationSnapshot[]>>;
  readonly setActiveById: jest.MockedFunction<(id: bigint, isActive: boolean) => Promise<number>>;
};

const createRepositoryMock = (): RepositoryMock => ({
  findAll: jest.fn<Promise<IntegrationSnapshot[]>, []>(),
  setActiveById: jest.fn<Promise<number>, [bigint, boolean]>(),
});

describe('KapsoWhatsappNumbersService', () => {
  it('lists integrations serialized for the CRM frontend', async () => {
    const repository = createRepositoryMock();
    repository.findAll.mockResolvedValue([createIntegration()]);
    const service = new KapsoWhatsappNumbersService(repository);

    await expect(service.findAll()).resolves.toEqual([
      expect.objectContaining({
        id: '1',
        isActive: true,
        kapsoPhoneNumberId: 'phone-1',
      }),
    ]);
  });

  it('returns an empty list when there are no integrations', async () => {
    const repository = createRepositoryMock();
    repository.findAll.mockResolvedValue([]);
    const service = new KapsoWhatsappNumbersService(repository);

    await expect(service.findAll()).resolves.toEqual([]);
  });

  it('activates an existing integration', async () => {
    const repository = createRepositoryMock();
    repository.setActiveById.mockResolvedValue(1);
    const service = new KapsoWhatsappNumbersService(repository);

    await expect(service.activate('1')).resolves.toEqual({ id: '1', isActive: true });
    expect(repository.setActiveById).toHaveBeenCalledWith(BigInt(1), true);
  });

  it('deactivates an existing integration', async () => {
    const repository = createRepositoryMock();
    repository.setActiveById.mockResolvedValue(1);
    const service = new KapsoWhatsappNumbersService(repository);

    await expect(service.deactivate('1')).resolves.toEqual({ id: '1', isActive: false });
    expect(repository.setActiveById).toHaveBeenCalledWith(BigInt(1), false);
  });

  it('rejects invalid integration ids', async () => {
    const repository = createRepositoryMock();
    const service = new KapsoWhatsappNumbersService(repository);

    await expect(service.activate('abc')).rejects.toThrow(NotFoundException);
    expect(repository.setActiveById).not.toHaveBeenCalled();
  });

  it('returns 404 when activating a missing integration', async () => {
    const repository = createRepositoryMock();
    repository.setActiveById.mockResolvedValue(0);
    const service = new KapsoWhatsappNumbersService(repository);

    await expect(service.activate('999')).rejects.toThrow(NotFoundException);
  });
});
