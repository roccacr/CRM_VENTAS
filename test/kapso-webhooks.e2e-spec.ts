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
    reserveWebhookReceipt: jest.fn(),
    completeWebhookReceipt: jest.fn(),
    touchPhoneNumberWebhookEvent: jest.fn(),
    recordWebhookSyncResult: jest.fn(),
  };

  const signatureServiceMock = {
    verifySignature: jest.fn(),
  };

  const syncServiceMock = {
    handlePhoneNumberCreatedEvent: jest.fn(),
    handlePhoneNumberDeletedEvent: jest.fn(),
    processInboundMessageWebhook: jest.fn(),
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
    signatureServiceMock.verifySignature.mockReturnValue(true);
    repositoryMock.reserveWebhookReceipt.mockResolvedValue({
      acquired: true,
      payloadMismatch: false,
      phoneNumberId: "1197677976762773",
      status: "processing",
    });
    syncServiceMock.processInboundMessageWebhook.mockResolvedValue({
      processed: 0,
      answeredNo: 0,
      answeredYes: 0,
      ignored: 0,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("evita reprocesar un webhook de plataforma duplicado", async () => {
    repositoryMock.reserveWebhookReceipt.mockResolvedValue({
      acquired: false,
      payloadMismatch: false,
      phoneNumberId: "1197677976762773",
      status: "processed",
    });

    await request(app.getHttpServer())
      .post("/api/v1/webhooks/kapso/platform")
      .set("x-idempotency-key", "dup-123")
      .set("x-webhook-signature", "valid-signature")
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
      .set("x-webhook-signature", "valid-signature")
      .send({
        object: "whatsapp_business_account",
        phone_number_id: "1197677976762773",
      })
      .expect(200)
      .expect({ ok: true });

    expect(repositoryMock.touchPhoneNumberWebhookEvent).toHaveBeenCalled();
    expect(syncServiceMock.processInboundMessageWebhook).toHaveBeenCalled();
  });

  it("rechaza un webhook meta sin firma valida antes de consultar idempotencia", async () => {
    signatureServiceMock.verifySignature.mockReturnValue(false);

    await request(app.getHttpServer())
      .post("/api/v1/webhooks/kapso/meta")
      .set("x-idempotency-key", "meta-invalid-001")
      .set("x-webhook-signature", "invalid-signature")
      .send({
        object: "whatsapp_business_account",
        phone_number_id: "1197677976762773",
      })
      .expect(401);

    expect(repositoryMock.reserveWebhookReceipt).not.toHaveBeenCalled();
    expect(repositoryMock.touchPhoneNumberWebhookEvent).not.toHaveBeenCalled();
    expect(syncServiceMock.processInboundMessageWebhook).not.toHaveBeenCalled();
  });

  it("procesa respuestas entrantes desde webhook Kapso sin cambiar la respuesta publica", async () => {
    repositoryMock.findProcessedWebhookDuplicate.mockResolvedValue(null);
    signatureServiceMock.verifySignature.mockReturnValue(true);
    syncServiceMock.processInboundMessageWebhook.mockResolvedValue({
      processed: 1,
      answeredNo: 1,
      answeredYes: 0,
      ignored: 0,
    });

    await request(app.getHttpServer())
      .post("/api/v1/webhooks/kapso/events")
      .set("x-idempotency-key", "kapso-no-001")
      .set("x-webhook-signature", "valid-signature")
      .set("x-webhook-event", "whatsapp.message.received")
      .send({
        phone_number_id: "1197677976762773",
        messages: [
          {
            from: "50687515938",
            type: "button",
            button: {
              text: "No, gracias",
            },
          },
        ],
      })
      .expect(200)
      .expect({ ok: true });

    expect(syncServiceMock.processInboundMessageWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        phone_number_id: "1197677976762773",
      }),
    );
  });

  it("procesa respuestas afirmativas entrantes desde webhook Kapso sin cambiar la respuesta publica", async () => {
    repositoryMock.findProcessedWebhookDuplicate.mockResolvedValue(null);
    signatureServiceMock.verifySignature.mockReturnValue(true);
    syncServiceMock.processInboundMessageWebhook.mockResolvedValue({
      processed: 1,
      answeredNo: 0,
      answeredYes: 1,
      ignored: 0,
    });

    await request(app.getHttpServer())
      .post("/api/v1/webhooks/kapso/events")
      .set("x-idempotency-key", "kapso-yes-001")
      .set("x-webhook-signature", "valid-signature")
      .set("x-webhook-event", "whatsapp.message.received")
      .send({
        phone_number_id: "1197677976762773",
        messages: [
          {
            from: "50687515938",
            type: "button",
            button: {
              text: "Sí, enviar información",
            },
          },
        ],
      })
      .expect(200)
      .expect({ ok: true });

    expect(syncServiceMock.processInboundMessageWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        phone_number_id: "1197677976762773",
      }),
    );
  });
});
