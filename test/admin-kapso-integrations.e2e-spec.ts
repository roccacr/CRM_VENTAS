import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as request from "supertest";

import { AdminKapsoIntegrationsController } from "../src/modules/kapso/controllers/admin-kapso-integrations.controller";
import { AdminKapsoIntegrationsService } from "../src/modules/kapso/services/admin-kapso-integrations.service";

describe("AdminKapsoIntegrationsController (e2e)", () => {
  let app: INestApplication;

  const serviceMock = {
    listAdministratorOptions: jest.fn(),
    listKapsoIntegrationOptions: jest.fn(),
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
