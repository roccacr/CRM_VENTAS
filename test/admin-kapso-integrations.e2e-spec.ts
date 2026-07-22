import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import * as request from "supertest";

import { AdminKapsoIntegrationsController } from "../src/modules/kapso/controllers/admin-kapso-integrations.controller";
import { AdminKapsoIntegrationsService } from "../src/modules/kapso/services/admin-kapso-integrations.service";

describe("AdminKapsoIntegrationsController (e2e)", () => {
  let app: INestApplication;

  const serviceMock = {
    listAdministratorOptions: jest.fn(),
    listKapsoIntegrationOptions: jest.fn(),
    listProjectOptions: jest.fn(),
    listBusinessFlows: jest.fn(),
    updateBusinessFlowStatus: jest.fn(),
    enableBusinessFlowProject: jest.fn(),
    disableBusinessFlowProject: jest.fn(),
    listFlowProjectMedia: jest.fn(),
    uploadFlowProjectMedia: jest.fn(),
    deleteFlowProjectMedia: jest.fn(),
    getMediaFileByStoredFilename: jest.fn(),
    assertMediaUrlValid: jest.fn(),
    createRelation: jest.fn(),
    listRelations: jest.fn(),
    getRelationById: jest.fn(),
    updateRelation: jest.fn(),
    updateRelationStatus: jest.fn(),
    deleteRelation: jest.fn(),
    listActiveIntegrationsByAdmin: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminKapsoIntegrationsController],
      providers: [{ provide: AdminKapsoIntegrationsService, useValue: serviceMock }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: false,
      }),
    );
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it("lista opciones de administradores", async () => {
    serviceMock.listAdministratorOptions.mockResolvedValue([
      {
        idnetsuiteAdmin: 2146844,
        name: "Roberto TI Rocca",
      },
    ]);

    await request(app.getHttpServer())
      .get("/api/v1/kapso/admins/options?search=Roberto")
      .expect(200)
      .expect([
        {
          idnetsuiteAdmin: 2146844,
          name: "Roberto TI Rocca",
        },
      ]);

    expect(serviceMock.listAdministratorOptions).toHaveBeenCalledWith("Roberto", false);
  });

  it("crea una asignacion valida", async () => {
    serviceMock.createRelation.mockResolvedValue({
      id: 12,
      idnetsuiteAdmin: 2146844,
      kapsoPhoneNumberId: 3,
      status: 1,
    });

    await request(app.getHttpServer())
      .post("/api/v1/kapso/admin-integrations")
      .send({
        idnetsuiteAdmin: 2146844,
        kapsoPhoneNumberId: 3,
        status: 1,
      })
      .expect(201)
      .expect({
        id: 12,
        idnetsuiteAdmin: 2146844,
        kapsoPhoneNumberId: 3,
        status: 1,
      });
  });

  it("lista proyectos disponibles para configurar flujos", async () => {
    serviceMock.listProjectOptions.mockResolvedValue([
      {
        idProyecto: 38,
        idProNetsuite: 38,
        name: "Andira",
        status: 1,
      },
    ]);

    await request(app.getHttpServer())
      .get("/api/v1/kapso/projects/options?search=Andira")
      .expect(200)
      .expect([
        {
          idProyecto: 38,
          idProNetsuite: 38,
          name: "Andira",
          status: 1,
        },
      ]);

    expect(serviceMock.listProjectOptions).toHaveBeenCalledWith("Andira", false);
  });

  it("lista flujos de negocio configurables por proyecto", async () => {
    serviceMock.listBusinessFlows.mockResolvedValue([
      {
        flowUuid: "flow-uuid",
        flowName: "Saludo inicial y seguimiento de leads",
        status: "draft",
        enabled: 0,
        projects: [],
        steps: [
          {
            stepCode: "saludo",
            templateName: "saludo",
            templateStatus: "approved",
          },
        ],
      },
    ]);

    await request(app.getHttpServer())
      .get("/api/v1/kapso/business-flows")
      .expect(200)
      .expect([
        {
          flowUuid: "flow-uuid",
          flowName: "Saludo inicial y seguimiento de leads",
          status: "draft",
          enabled: 0,
          projects: [],
          steps: [
            {
              stepCode: "saludo",
              templateName: "saludo",
              templateStatus: "approved",
            },
          ],
        },
      ]);
  });

  it("activa o inactiva un flujo de negocio", async () => {
    serviceMock.updateBusinessFlowStatus.mockResolvedValue({
      ok: true,
      flowUuid: "flow-uuid",
      enabled: 0,
    });

    await request(app.getHttpServer()).patch("/api/v1/kapso/business-flows/flow-uuid/status").send({ enabled: false }).expect(200).expect({
      ok: true,
      flowUuid: "flow-uuid",
      enabled: 0,
    });

    expect(serviceMock.updateBusinessFlowStatus).toHaveBeenCalledWith("flow-uuid", false);
  });

  it("habilita un proyecto para un flujo de negocio", async () => {
    serviceMock.enableBusinessFlowProject.mockResolvedValue({
      idProyecto: 38,
      idProyectoNetsuite: 38,
      nombreProyecto: "Andira",
      enabled: 1,
    });

    await request(app.getHttpServer()).post("/api/v1/kapso/business-flows/flow-uuid/projects").send({ idProyecto: 38 }).expect(201).expect({
      idProyecto: 38,
      idProyectoNetsuite: 38,
      nombreProyecto: "Andira",
      enabled: 1,
    });

    expect(serviceMock.enableBusinessFlowProject).toHaveBeenCalledWith("flow-uuid", 38);
  });

  it("deshabilita un proyecto de un flujo de negocio", async () => {
    serviceMock.disableBusinessFlowProject.mockResolvedValue({
      ok: true,
      flowUuid: "flow-uuid",
      idProyecto: 38,
      idProyectoNetsuite: 38,
    });

    await request(app.getHttpServer()).delete("/api/v1/kapso/business-flows/flow-uuid/projects/38").expect(200).expect({
      ok: true,
      flowUuid: "flow-uuid",
      idProyecto: 38,
      idProyectoNetsuite: 38,
    });

    expect(serviceMock.disableBusinessFlowProject).toHaveBeenCalledWith("flow-uuid", 38);
  });

  it("lista adjuntos de intro por flujo y proyecto", async () => {
    serviceMock.listFlowProjectMedia.mockResolvedValue([
      {
        id: 1,
        mediaType: "video",
        publicUrl: "https://crm.example.com/api/v1/kapso/media/intro.mp4",
      },
    ]);

    await request(app.getHttpServer())
      .get("/api/v1/kapso/flows/flow-uuid/projects/38/media?stepCode=intro")
      .expect(200)
      .expect([
        {
          id: 1,
          mediaType: "video",
          publicUrl: "https://crm.example.com/api/v1/kapso/media/intro.mp4",
        },
      ]);

    expect(serviceMock.listFlowProjectMedia).toHaveBeenCalledWith("flow-uuid", 38, "intro");
  });

  it("sirve adjuntos con politica cross-origin para previews del CRM", async () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "kapso-media-"));
    const absolutePath = join(tempDirectory, "preview.jpg");

    writeFileSync(absolutePath, Buffer.from("fake image"));

    serviceMock.getMediaFileByStoredFilename.mockResolvedValue({
      absolutePath,
      mimeType: "image/jpeg",
      originalName: "preview.jpg",
    });

    try {
      await request(app.getHttpServer())
        .get("/api/v1/kapso/media/preview.jpg?expires=1800000060&signature=valid-signature")
        .expect(200)
        .expect("Cross-Origin-Resource-Policy", "cross-origin")
        .expect("Content-Type", /image\/jpeg/);

      expect(serviceMock.assertMediaUrlValid).toHaveBeenCalledWith("preview.jpg", "1800000060", "valid-signature");
      expect(serviceMock.getMediaFileByStoredFilename).toHaveBeenCalledWith("preview.jpg");
    } finally {
      rmSync(tempDirectory, { force: true, recursive: true });
    }
  });

  it("sube un adjunto de intro por flujo y proyecto", async () => {
    serviceMock.uploadFlowProjectMedia.mockResolvedValue({
      id: 2,
      mediaType: "image",
      originalName: "foto.jpg",
    });

    await request(app.getHttpServer())
      .post("/api/v1/kapso/flows/flow-uuid/projects/38/media")
      .field("stepCode", "intro")
      .field("sortOrder", "1")
      .attach("file", Buffer.from("fake image"), "foto.jpg")
      .expect(201)
      .expect({
        id: 2,
        mediaType: "image",
        originalName: "foto.jpg",
      });

    expect(serviceMock.uploadFlowProjectMedia).toHaveBeenCalledWith(
      "flow-uuid",
      38,
      expect.objectContaining({
        originalname: "foto.jpg",
      }),
      {
        stepCode: "intro",
        sortOrder: 1,
      },
    );
  });

  it("desactiva un adjunto de intro", async () => {
    serviceMock.deleteFlowProjectMedia.mockResolvedValue({
      id: 2,
      active: false,
    });

    await request(app.getHttpServer()).delete("/api/v1/kapso/flow-project-media/2").expect(200).expect({
      id: 2,
      active: false,
    });

    expect(serviceMock.deleteFlowProjectMedia).toHaveBeenCalledWith(2);
  });

  it("valida campos requeridos en create", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/kapso/admin-integrations")
      .send({
        idnetsuiteAdmin: 2146844,
      })
      .expect(400);
  });

  it("lista relaciones existentes con metadatos", async () => {
    serviceMock.listRelations.mockResolvedValue({
      items: [
        {
          id: 12,
          administratorName: "Roberto TI Rocca",
          displayPhoneNumber: "+506 7045 2242",
          status: 1,
        },
      ],
      meta: {
        total: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      },
    });

    await request(app.getHttpServer())
      .get("/api/v1/kapso/admin-integrations?page=1&pageSize=10")
      .expect(200)
      .expect({
        items: [
          {
            id: 12,
            administratorName: "Roberto TI Rocca",
            displayPhoneNumber: "+506 7045 2242",
            status: 1,
          },
        ],
        meta: {
          total: 1,
          page: 1,
          pageSize: 10,
          totalPages: 1,
        },
      });
  });

  it("actualiza el estado de una relacion", async () => {
    serviceMock.updateRelationStatus.mockResolvedValue({
      id: 12,
      status: 0,
    });

    await request(app.getHttpServer()).patch("/api/v1/kapso/admin-integrations/12/status").send({ status: 0 }).expect(200).expect({
      id: 12,
      status: 0,
    });
  });

  it("resuelve integraciones operativas por administrador", async () => {
    serviceMock.listActiveIntegrationsByAdmin.mockResolvedValue([
      {
        relationId: 91,
        idnetsuiteAdmin: 2146844,
        phoneNumberId: "1197677976762773",
      },
    ]);

    await request(app.getHttpServer())
      .get("/api/v1/kapso/admins/2146844/integrations")
      .expect(200)
      .expect([
        {
          relationId: 91,
          idnetsuiteAdmin: 2146844,
          phoneNumberId: "1197677976762773",
        },
      ]);
  });

  it("elimina una relacion", async () => {
    serviceMock.deleteRelation.mockResolvedValue({
      ok: true,
      id: 12,
      message: "La relacion adminâ€“Kapso fue eliminada.",
    });

    await request(app.getHttpServer()).delete("/api/v1/kapso/admin-integrations/12").expect(200).expect({
      ok: true,
      id: 12,
      message: "La relacion adminâ€“Kapso fue eliminada.",
    });
  });
});
