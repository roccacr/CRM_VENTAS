import { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import * as request from "supertest";

import { KapsoWebhooksController } from "../src/modules/kapso/controllers/kapso-webhooks.controller";
import { KapsoRepository } from "../src/modules/kapso/repositories/kapso.repository";
import { KapsoSignatureService } from "../src/modules/kapso/services/kapso-signature.service";
import { KapsoSyncService } from "../src/modules/kapso/services/kapso-sync.service";

describe("KapsoWebhooksController (e2e)", () => {
  let app: INestApplication;

  const repositoryMock = {
    findProcessedWebhookDuplicate: jest.fn(),
    touchPhoneNumberWebhookEvent: jest.fn(),
    recordWebhookSyncResult: jest.fn(),
  };

  const signatureServiceMock = {
    verifySignature: jest.fn(),
  };

  const syncServiceMock = {
    handlePhoneNumberCreatedEvent: jest.fn(),
    handlePhoneNumberDeletedEvent: jest.fn(),
  };

  const configServiceMock = {
    getOrThrow: jest.fn((key: string) => {
      if (key === "kapso.platformWebhookSecret") {
        return "platform-secret";
      }

      if (key === "kapso.whatsappWebhookSecret") {
        return "whatsapp-secret";
      }

      return "";
    }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [KapsoWebhooksController],
      providers: [
        { provide: ConfigService, useValue: configServiceMock },
        { provide: KapsoRepository, useValue: repositoryMock },
        { provide: KapsoSignatureService, useValue: signatureServiceMock },
        { provide: KapsoSyncService, useValue: syncServiceMock },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it("evita reprocesar un webhook de plataforma duplicado", async () => {
    repositoryMock.findProcessedWebhookDuplicate.mockResolvedValue({
      phoneNumberId: "1197677976762773",
      lastProcessingStatus: "processed",
    });

    await request(app.getHttpServer())
      .post("/api/v1/webhooks/kapso/platform")
      .set("x-idempotency-key", "dup-123")
      .send({
        event: "whatsapp.phone_number.created",
        phone_number_id: "1197677976762773",
      })
      .expect(200)
      .expect({
        ok: true,
        duplicate: true,
        phoneNumberId: "1197677976762773",
        status: "processed",
      });

    expect(repositoryMock.touchPhoneNumberWebhookEvent).not.toHaveBeenCalled();
    expect(syncServiceMock.handlePhoneNumberCreatedEvent).not.toHaveBeenCalled();
  });

  it("procesa un webhook de plataforma valido", async () => {
    repositoryMock.findProcessedWebhookDuplicate.mockResolvedValue(null);
    signatureServiceMock.verifySignature.mockReturnValue(true);
    syncServiceMock.handlePhoneNumberCreatedEvent.mockResolvedValue({
      lastProcessingStatus: "processed",
      setupSyncStatus: "processed",
    });

    await request(app.getHttpServer())
      .post("/api/v1/webhooks/kapso/platform")
      .set("x-idempotency-key", "evt-001")
      .set("x-webhook-signature", "valid-signature")
      .send({
        event: "whatsapp.phone_number.created",
        phone_number_id: "1197677976762773",
      })
      .expect(200)
      .expect({ ok: true });

    expect(repositoryMock.touchPhoneNumberWebhookEvent).toHaveBeenCalled();
    expect(syncServiceMock.handlePhoneNumberCreatedEvent).toHaveBeenCalledWith({
      event: "whatsapp.phone_number.created",
      phone_number_id: "1197677976762773",
    });
  });

  it("deja pendiente la sincronizacion si Kapso aun no expone el numero creado", async () => {
    repositoryMock.findProcessedWebhookDuplicate.mockResolvedValue(null);
    signatureServiceMock.verifySignature.mockReturnValue(true);
    syncServiceMock.handlePhoneNumberCreatedEvent.mockRejectedValue(
      new Error('Kapso API error: {"error":"WhatsApp configuration not found"}'),
    );

    await request(app.getHttpServer())
      .post("/api/v1/webhooks/kapso/platform")
      .set("x-idempotency-key", "evt-pending-001")
      .set("x-webhook-signature", "valid-signature")
      .send({
        event: "whatsapp.phone_number.created",
        phone_number_id: "1197677976762773",
      })
      .expect(200)
      .expect({ ok: true, pendingSync: true });

    expect(repositoryMock.recordWebhookSyncResult).toHaveBeenCalledWith(
      "1197677976762773",
      "pending_remote_sync",
      'Kapso API error: {"error":"WhatsApp configuration not found"}',
    );
  });

  it("procesa un webhook de plataforma de eliminacion", async () => {
    repositoryMock.findProcessedWebhookDuplicate.mockResolvedValue(null);
    signatureServiceMock.verifySignature.mockReturnValue(true);

    await request(app.getHttpServer())
      .post("/api/v1/webhooks/kapso/platform")
      .set("x-idempotency-key", "evt-del-001")
      .set("x-webhook-signature", "valid-signature")
      .send({
        event: "whatsapp.phone_number.deleted",
        phone_number_id: "1197677976762773",
      })
      .expect(200)
      .expect({ ok: true });

    expect(repositoryMock.touchPhoneNumberWebhookEvent).toHaveBeenCalled();
    expect(syncServiceMock.handlePhoneNumberDeletedEvent).toHaveBeenCalledWith({
      event: "whatsapp.phone_number.deleted",
      phone_number_id: "1197677976762773",
    });
    expect(repositoryMock.recordWebhookSyncResult).toHaveBeenCalledWith("1197677976762773", "processed");
  });

  it("procesa un webhook meta y registra el evento", async () => {
    repositoryMock.findProcessedWebhookDuplicate.mockResolvedValue(null);

    await request(app.getHttpServer())
      .post("/api/v1/webhooks/kapso/meta")
      .set("x-idempotency-key", "meta-001")
      .send({
        object: "whatsapp_business_account",
        phone_number_id: "1197677976762773",
      })
      .expect(200)
      .expect({ ok: true });

    expect(repositoryMock.touchPhoneNumberWebhookEvent).toHaveBeenCalled();
  });
});
