// ============================================================================
// IMPORTS
// ============================================================================

import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";

import { AdminKapsoIntegrationsService } from "../../src/modules/kapso/services/admin-kapso-integrations.service";

// ============================================================================
// CONSTANTES DE PRUEBA
// ============================================================================

const ACTIVE_ADMIN = {
  idnetsuiteAdmin: 2146844,
  idAdmin: 10,
  name: "Roberto TI Rocca",
  email: "soporte@roccacr.com",
  status: 1,
};

const INACTIVE_ADMIN = {
  ...ACTIVE_ADMIN,
  status: 0,
};

const ACTIVE_PHONE_NUMBER = {
  id: 3,
  phoneNumberId: "1197677976762773",
  displayPhoneNumber: "+506 7045 2242",
  phoneNumberName: "RDG Ventas",
  verifiedName: "RDG Ventas",
  businessAccountId: "3174045732780123",
  active: true,
  status: "CONNECTED",
  setupStatus: "completed",
  setupSyncStatus: "processed",
};

const INACTIVE_PHONE_NUMBER = {
  ...ACTIVE_PHONE_NUMBER,
  active: false,
};

// ============================================================================
// HELPERS DE TEST
// ============================================================================

function createServiceTestBed() {
  const repositoryMock = {
    listAdminOptions: jest.fn(),
    listKapsoPhoneNumberOptions: jest.fn(),
    findAdminOptionByNetSuiteId: jest.fn(),
    findKapsoPhoneNumberOptionById: jest.fn(),
    findDuplicateRelation: jest.fn(),
    createRelation: jest.fn(),
    listRelations: jest.fn(),
    findRelationById: jest.fn(),
    findRelationDetailById: jest.fn(),
    updateRelation: jest.fn(),
    updateRelationStatus: jest.fn(),
    deleteRelation: jest.fn(),
    listActiveIntegrationsByAdmin: jest.fn(),
  };

  const service = new AdminKapsoIntegrationsService(repositoryMock as never);

  return {
    service,
    repositoryMock,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe("AdminKapsoIntegrationsService", () => {
  let service: AdminKapsoIntegrationsService;
  let repositoryMock: ReturnType<typeof createServiceTestBed>["repositoryMock"];

  beforeEach(() => {
    jest.clearAllMocks();

    const testBed = createServiceTestBed();
    service = testBed.service;
    repositoryMock = testBed.repositoryMock;
  });

  it("crea una relacion valida y devuelve el detalle enriquecido", async () => {
    repositoryMock.findAdminOptionByNetSuiteId.mockResolvedValue(ACTIVE_ADMIN);
    repositoryMock.findKapsoPhoneNumberOptionById.mockResolvedValue(ACTIVE_PHONE_NUMBER);
    repositoryMock.findDuplicateRelation.mockResolvedValue(null);
    repositoryMock.createRelation.mockResolvedValue({ id: 25 });
    repositoryMock.findRelationDetailById.mockResolvedValue({
      id: 25,
      idnetsuiteAdmin: ACTIVE_ADMIN.idnetsuiteAdmin,
      kapsoPhoneNumberId: ACTIVE_PHONE_NUMBER.id,
      status: 1,
    });

    const result = await service.createRelation({
      idnetsuiteAdmin: ACTIVE_ADMIN.idnetsuiteAdmin,
      kapsoPhoneNumberId: ACTIVE_PHONE_NUMBER.id,
      status: 1,
    });

    expect(result).toEqual({
      id: 25,
      idnetsuiteAdmin: ACTIVE_ADMIN.idnetsuiteAdmin,
      kapsoPhoneNumberId: ACTIVE_PHONE_NUMBER.id,
      status: 1,
    });
    expect(repositoryMock.createRelation).toHaveBeenCalledWith({
      idnetsuiteAdmin: ACTIVE_ADMIN.idnetsuiteAdmin,
      kapsoPhoneNumberId: ACTIVE_PHONE_NUMBER.id,
      status: 1,
    });
  });

  it("rechaza relaciones duplicadas", async () => {
    repositoryMock.findAdminOptionByNetSuiteId.mockResolvedValue(ACTIVE_ADMIN);
    repositoryMock.findKapsoPhoneNumberOptionById.mockResolvedValue(ACTIVE_PHONE_NUMBER);
    repositoryMock.findDuplicateRelation.mockResolvedValue({ id: 99 });

    await expect(
      service.createRelation({
        idnetsuiteAdmin: ACTIVE_ADMIN.idnetsuiteAdmin,
        kapsoPhoneNumberId: ACTIVE_PHONE_NUMBER.id,
        status: 1,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rechaza administradores inexistentes", async () => {
    repositoryMock.findAdminOptionByNetSuiteId.mockResolvedValue(null);

    await expect(
      service.createRelation({
        idnetsuiteAdmin: ACTIVE_ADMIN.idnetsuiteAdmin,
        kapsoPhoneNumberId: ACTIVE_PHONE_NUMBER.id,
        status: 1,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rechaza administradores inactivos para nuevas asignaciones", async () => {
    repositoryMock.findAdminOptionByNetSuiteId.mockResolvedValue(INACTIVE_ADMIN);

    await expect(
      service.createRelation({
        idnetsuiteAdmin: INACTIVE_ADMIN.idnetsuiteAdmin,
        kapsoPhoneNumberId: ACTIVE_PHONE_NUMBER.id,
        status: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rechaza integraciones Kapso inactivas para nuevas asignaciones", async () => {
    repositoryMock.findAdminOptionByNetSuiteId.mockResolvedValue(ACTIVE_ADMIN);
    repositoryMock.findKapsoPhoneNumberOptionById.mockResolvedValue(INACTIVE_PHONE_NUMBER);

    await expect(
      service.createRelation({
        idnetsuiteAdmin: ACTIVE_ADMIN.idnetsuiteAdmin,
        kapsoPhoneNumberId: INACTIVE_PHONE_NUMBER.id,
        status: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("actualiza una relacion existente sin permitir duplicados", async () => {
    repositoryMock.findRelationById.mockResolvedValue({
      id: 31,
      idnetsuiteAdmin: ACTIVE_ADMIN.idnetsuiteAdmin,
      kapsoPhoneNumberId: ACTIVE_PHONE_NUMBER.id,
      status: 1,
    });
    repositoryMock.findAdminOptionByNetSuiteId.mockResolvedValue(ACTIVE_ADMIN);
    repositoryMock.findKapsoPhoneNumberOptionById.mockResolvedValue(ACTIVE_PHONE_NUMBER);
    repositoryMock.findDuplicateRelation.mockResolvedValue(null);
    repositoryMock.findRelationDetailById.mockResolvedValue({
      id: 31,
      idnetsuiteAdmin: ACTIVE_ADMIN.idnetsuiteAdmin,
      kapsoPhoneNumberId: ACTIVE_PHONE_NUMBER.id,
      status: 0,
    });

    const result = await service.updateRelation(31, {
      idnetsuiteAdmin: ACTIVE_ADMIN.idnetsuiteAdmin,
      kapsoPhoneNumberId: ACTIVE_PHONE_NUMBER.id,
      status: 0,
    });

    expect(result).toEqual({
      id: 31,
      idnetsuiteAdmin: ACTIVE_ADMIN.idnetsuiteAdmin,
      kapsoPhoneNumberId: ACTIVE_PHONE_NUMBER.id,
      status: 0,
    });
    expect(repositoryMock.updateRelation).toHaveBeenCalledWith(expect.objectContaining({ id: 31 }), expect.objectContaining({ status: 0 }));
  });

  it("activa o desactiva una relacion existente", async () => {
    repositoryMock.findRelationById.mockResolvedValue({
      id: 44,
      status: 1,
    });
    repositoryMock.findRelationDetailById.mockResolvedValue({
      id: 44,
      status: 0,
    });

    const result = await service.updateRelationStatus(44, { status: 0 });

    expect(result).toEqual({
      id: 44,
      status: 0,
    });
    expect(repositoryMock.updateRelationStatus).toHaveBeenCalledWith(expect.objectContaining({ id: 44 }), 0);
  });

  it("elimina una relacion existente", async () => {
    repositoryMock.findRelationById.mockResolvedValue({
      id: 55,
      status: 1,
    });

    const result = await service.deleteRelation(55);

    expect(result).toEqual({
      ok: true,
      id: 55,
      message: "La relacion admin–Kapso fue eliminada.",
    });
    expect(repositoryMock.deleteRelation).toHaveBeenCalledWith(expect.objectContaining({ id: 55 }));
  });

  it("resuelve integraciones activas por administrador", async () => {
    repositoryMock.findAdminOptionByNetSuiteId.mockResolvedValue(ACTIVE_ADMIN);
    repositoryMock.listActiveIntegrationsByAdmin.mockResolvedValue([
      {
        relationId: 71,
        idnetsuiteAdmin: ACTIVE_ADMIN.idnetsuiteAdmin,
        kapsoPhoneNumberId: ACTIVE_PHONE_NUMBER.id,
      },
    ]);

    const result = await service.listActiveIntegrationsByAdmin(ACTIVE_ADMIN.idnetsuiteAdmin);

    expect(result).toEqual([
      {
        relationId: 71,
        idnetsuiteAdmin: ACTIVE_ADMIN.idnetsuiteAdmin,
        kapsoPhoneNumberId: ACTIVE_PHONE_NUMBER.id,
      },
    ]);
    expect(repositoryMock.listActiveIntegrationsByAdmin).toHaveBeenCalledWith(ACTIVE_ADMIN.idnetsuiteAdmin);
  });
});
