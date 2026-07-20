// ============================================================================
// IMPORTS
// ============================================================================

import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

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
    listProjectOptions: jest.fn(),
    listBusinessFlows: jest.fn(),
    enableBusinessFlowProject: jest.fn(),
    disableBusinessFlowProject: jest.fn(),
    findBusinessFlowProject: jest.fn(),
    listFlowProjectMedia: jest.fn(),
    createFlowProjectMedia: jest.fn(),
    findFlowProjectMediaById: jest.fn(),
    findFlowProjectMediaByStoredFilename: jest.fn(),
    deactivateFlowProjectMedia: jest.fn(),
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

  const configServiceMock = {
    get: jest.fn((key: string) => {
      if (key === "kapso.mediaStoragePath") {
        return undefined;
      }

      if (key === "kapso.mediaMaxFileSizeBytes") {
        return 50 * 1024 * 1024;
      }

      return undefined;
    }),
    getOrThrow: jest.fn((key: string) => {
      if (key === "kapso.publicBaseUrl") {
        return "https://crm.example.com";
      }

      if (key === "app.apiPrefix") {
        return "api/v1";
      }

      throw new Error(`Unexpected config key ${key}`);
    }),
  };

  const service = new AdminKapsoIntegrationsService(repositoryMock as never, configServiceMock as unknown as ConfigService);

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

  it("lista flujos de negocio configurables", async () => {
    repositoryMock.listBusinessFlows.mockResolvedValue([
      {
        flowUuid: "flow-uuid",
        flowName: "Saludo inicial y seguimiento de leads",
        projects: [],
        steps: [],
      },
    ]);

    const result = await service.listBusinessFlows();

    expect(result).toEqual([
      {
        flowUuid: "flow-uuid",
        flowName: "Saludo inicial y seguimiento de leads",
        projects: [],
        steps: [],
      },
    ]);
  });

  it("habilita un proyecto para un flujo de negocio", async () => {
    repositoryMock.enableBusinessFlowProject.mockResolvedValue({
      idProyecto: 38,
      idProyectoNetsuite: 38,
      nombreProyecto: "Andira",
      enabled: 1,
    });

    const result = await service.enableBusinessFlowProject("flow-uuid", 38);

    expect(result).toEqual({
      idProyecto: 38,
      idProyectoNetsuite: 38,
      nombreProyecto: "Andira",
      enabled: 1,
    });
    expect(repositoryMock.enableBusinessFlowProject).toHaveBeenCalledWith("flow-uuid", 38);
  });

  it("rechaza habilitar un proyecto inexistente para un flujo de negocio", async () => {
    repositoryMock.enableBusinessFlowProject.mockResolvedValue(null);

    await expect(service.enableBusinessFlowProject("flow-uuid", 999999)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("deshabilita un proyecto de un flujo de negocio", async () => {
    repositoryMock.disableBusinessFlowProject.mockResolvedValue({
      ok: true,
      flowUuid: "flow-uuid",
      idProyecto: 38,
      idProyectoNetsuite: 38,
    });

    const result = await service.disableBusinessFlowProject("flow-uuid", 38);

    expect(result).toEqual({
      ok: true,
      flowUuid: "flow-uuid",
      idProyecto: 38,
      idProyectoNetsuite: 38,
    });
    expect(repositoryMock.disableBusinessFlowProject).toHaveBeenCalledWith("flow-uuid", 38);
  });

  it("sube adjuntos dentro de la carpeta del flujo y proyecto habilitado", async () => {
    const storagePath = await mkdtemp(join(tmpdir(), "kapso-media-"));

    repositoryMock.findBusinessFlowProject.mockResolvedValue({
      idProyectoNetsuite: 38,
      nombreProyecto: "Andira",
      projectName: "Andira",
      enabled: 1,
    });
    repositoryMock.createFlowProjectMedia.mockImplementation(async (input) => ({
      id: 7,
      ...input,
      status: 1,
    }));

    jest.spyOn(service["configService"], "get").mockImplementation((key: string) => {
      if (key === "kapso.mediaStoragePath") {
        return storagePath;
      }

      if (key === "kapso.mediaMaxFileSizeBytes") {
        return 50 * 1024 * 1024;
      }

      return undefined;
    });

    try {
      const result = await service.uploadFlowProjectMedia(
        "flow-uuid",
        38,
        {
          originalname: "foto-andira.jpg",
          mimetype: "image/jpeg",
          size: 10,
          buffer: Buffer.from("fake image"),
        },
        { stepCode: "intro" },
      );

      expect(result).not.toBeNull();
      const media = result!;

      expect(media.relativePath).toMatch(/^flow-uuid\/proyectos\/38-andira\/[a-f0-9-]+\.jpg$/);
      await expect(readFile(join(storagePath, media.relativePath))).resolves.toEqual(Buffer.from("fake image"));
      expect(repositoryMock.createFlowProjectMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          flowUuid: "flow-uuid",
          idProyectoNetsuite: 38,
          stepCode: "intro",
          mediaType: "image",
          originalName: "foto-andira.jpg",
          relativePath: media.relativePath,
        }),
      );
    } finally {
      await rm(storagePath, {
        recursive: true,
        force: true,
      });
    }
  });

  it("oculta y desactiva adjuntos activos cuando el archivo fisico ya no existe", async () => {
    const storagePath = await mkdtemp(join(tmpdir(), "kapso-media-"));
    const existingRelativePath = "flow-uuid/proyectos/38-andira/existing.jpg";
    const missingRelativePath = "flow-uuid/proyectos/38-andira/missing.jpg";

    await mkdir(join(storagePath, "flow-uuid", "proyectos", "38-andira"), { recursive: true });
    await writeFile(join(storagePath, existingRelativePath), Buffer.from("ok"));

    repositoryMock.listFlowProjectMedia.mockResolvedValue([
      {
        id: 1,
        relativePath: existingRelativePath,
      },
      {
        id: 2,
        relativePath: missingRelativePath,
      },
    ]);

    jest.spyOn(service["configService"], "get").mockImplementation((key: string) => {
      if (key === "kapso.mediaStoragePath") {
        return storagePath;
      }

      return undefined;
    });

    try {
      const result = await service.listFlowProjectMedia("flow-uuid", 38, "intro");

      expect(result).toEqual([
        {
          id: 1,
          relativePath: existingRelativePath,
        },
      ]);
      expect(repositoryMock.deactivateFlowProjectMedia).toHaveBeenCalledWith(2);
    } finally {
      await rm(storagePath, {
        recursive: true,
        force: true,
      });
    }
  });

  it("elimina el archivo fisico cuando se retira un adjunto", async () => {
    const storagePath = await mkdtemp(join(tmpdir(), "kapso-media-"));
    const relativePath = "flow-uuid/proyectos/38-andira/delete-me.jpg";
    const absolutePath = join(storagePath, relativePath);

    await mkdir(join(storagePath, "flow-uuid", "proyectos", "38-andira"), { recursive: true });
    await writeFile(absolutePath, Buffer.from("delete me"));

    repositoryMock.deactivateFlowProjectMedia.mockResolvedValue({
      id: 12,
      relativePath,
    });

    jest.spyOn(service["configService"], "get").mockImplementation((key: string) => {
      if (key === "kapso.mediaStoragePath") {
        return storagePath;
      }

      return undefined;
    });

    try {
      const result = await service.deleteFlowProjectMedia(12);

      expect(result).toEqual({
        id: 12,
        relativePath,
      });
      await expect(readFile(absolutePath)).rejects.toMatchObject({ code: "ENOENT" });
      expect(repositoryMock.deactivateFlowProjectMedia).toHaveBeenCalledWith(12);
    } finally {
      await rm(storagePath, {
        recursive: true,
        force: true,
      });
    }
  });

  it("desactiva metadata cuando el archivo fisico del adjunto no existe al servirlo", async () => {
    const storagePath = await mkdtemp(join(tmpdir(), "kapso-media-"));

    repositoryMock.findFlowProjectMediaByStoredFilename.mockResolvedValue({
      id: 9,
      relativePath: "flow-uuid/proyectos/38-andira/missing.jpg",
      mimeType: "image/jpeg",
      originalName: "missing.jpg",
    });

    jest.spyOn(service["configService"], "get").mockImplementation((key: string) => {
      if (key === "kapso.mediaStoragePath") {
        return storagePath;
      }

      return undefined;
    });

    try {
      await expect(service.getMediaFileByStoredFilename("missing.jpg")).rejects.toBeInstanceOf(NotFoundException);
      expect(repositoryMock.deactivateFlowProjectMedia).toHaveBeenCalledWith(9);
    } finally {
      await rm(storagePath, {
        recursive: true,
        force: true,
      });
    }
  });

  it("rechaza adjuntos para proyectos no habilitados en el flujo", async () => {
    repositoryMock.findBusinessFlowProject.mockResolvedValue(null);

    await expect(
      service.uploadFlowProjectMedia("flow-uuid", 38, {
        originalname: "foto.jpg",
        mimetype: "image/jpeg",
        size: 10,
        buffer: Buffer.from("fake image"),
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
