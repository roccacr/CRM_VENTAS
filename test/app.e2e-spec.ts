import { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import * as request from "supertest";

import { AppController } from "../src/app.controller";

describe("AppController (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((_key: string, fallback: string) => fallback),
            getOrThrow: jest.fn((_key: string) => "0.1.0"),
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("/api/v1 (GET)", async () => {
    await request(app.getHttpServer()).get("/api/v1").expect(200).expect({
      ok: true,
      message: "API Kapso CRM lista para sincronizar proyectos, clientes y numeros.",
      version: "0.1.0",
    });
  });

  it("/api/v1/health (GET)", async () => {
    await request(app.getHttpServer()).get("/api/v1/health").expect(200).expect({
      ok: true,
      status: "up",
    });
  });
});
