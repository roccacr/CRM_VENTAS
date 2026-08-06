import { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { createHmac } from "crypto";
import * as request from "supertest";

import { KapsoWebhooksController } from "../src/modules/kapso/controllers/kapso-webhooks.controller";
import { KapsoRepository } from "../src/modules/kapso/repositories/kapso.repository";
import { KapsoSignatureService } from "../src/modules/kapso/services/kapso-signature.service";
import { KapsoSyncService } from "../src/modules/kapso/services/kapso-sync.service";

const PHONE_NUMBER_ID = "1197677976762773";
const WABA_ID = "3174045732780123";
const LEAD_PHONE = "50687515938";
const MESSAGE_ID = "wamid.HBgLNTA2ODc1MTU5MzgVAgARGBRDRTNCMzgxREZBMkQ4MjNEMUM4RAA=";

const WEBHOOK_SECRETS = {
  platform: "platform-secret",
  whatsapp: "whatsapp-secret",
  meta: "meta-secret",
};

function signPayload(payload: unknown, secret: string): string {
  return createHmac("sha256", secret).update(JSON.stringify(payload)).digest("hex");
}

function failedStatusPayload() {
  return {
    id: MESSAGE_ID,
    status: "failed",
    timestamp: "1784823115",
    recipient_id: LEAD_PHONE,
    recipient_user_id: "CR.1466291565177699",
    errors: [
      {
        code: 130472,
        title: "User's number is part of an experiment",
        message: "User's number is part of an experiment",
        error_data: {
          details: "Failed to send message because this user's phone number is part of an experiment",
        },
        href: "https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes/",
      },
    ],
  };
}

function kapsoFailedMessagePayload() {
  return {
    message: {
      id: MESSAGE_ID,
      to: LEAD_PHONE,
      type: "template",
      kapso: {
        origin: "cloud_api",
        status: "failed",
        content:
          "Hola Nombre del lead, soy Roberto Carlos Zuniga Altamirano, asesor de Andira. Vi que pediste informacion del proyecto. Te parece bien si te comparto la informacion por este medio?",
        statuses: [failedStatusPayload()],
        direction: "outbound",
        has_media: false,
        message_type_data: {
          name: "saludo",
          language: {
            code: "es_ES",
          },
          components: [
            {
              type: "body",
              parameters: [
                {
                  type: "text",
                  text: "Nombre del lead",
                },
                {
                  type: "text",
                  text: "Roberto Carlos Zuniga Altamirano",
                },
                {
                  type: "text",
                  text: "Andira",
                },
              ],
            },
          ],
        },
        processing_status: "processed",
      },
      timestamp: "1784823113",
      to_user_id: "CR.1466291565177699",
    },
    conversation: {
      id: "e212c4d1-070d-48e3-b318-d4fd6fbce85d",
      status: "active",
      phone_number: LEAD_PHONE,
      phone_number_id: PHONE_NUMBER_ID,
      business_scoped_user_id: "CR.1466291565177699",
    },
    phone_number_id: PHONE_NUMBER_ID,
    is_new_conversation: false,
  };
}

function metaFailedMessagePayload() {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: WABA_ID,
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "50670452242",
                phone_number_id: PHONE_NUMBER_ID,
              },
              contacts: [
                {
                  wa_id: LEAD_PHONE,
                  user_id: "CR.1466291565177699",
                },
              ],
              statuses: [failedStatusPayload()],
            },
            field: "messages",
          },
        ],
      },
    ],
  };
}

describe("Kapso webhook signatures (e2e)", () => {
  let app: INestApplication;

  const repositoryMock = {
    reserveWebhookReceipt: jest.fn(),
    completeWebhookReceipt: jest.fn(),
    touchPhoneNumberWebhookEvent: jest.fn(),
    recordWebhookSyncResult: jest.fn(),
  };

  const syncServiceMock = {
    handlePhoneNumberCreatedEvent: jest.fn(),
    handlePhoneNumberDeletedEvent: jest.fn(),
    processInboundMessageWebhook: jest.fn(),
  };

  const configServiceMock = {
    getOrThrow: jest.fn((key: string) => {
      if (key === "kapso.platformWebhookSecret") {
        return WEBHOOK_SECRETS.platform;
      }

      if (key === "kapso.whatsappWebhookSecret") {
        return WEBHOOK_SECRETS.whatsapp;
      }

      if (key === "kapso.metaWebhookSecret") {
        return WEBHOOK_SECRETS.meta;
      }

      throw new Error(`Missing test config: ${key}`);
    }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [KapsoWebhooksController],
      providers: [
        {
          provide: ConfigService,
          useValue: configServiceMock,
        },
        {
          provide: KapsoRepository,
          useValue: repositoryMock,
        },
        KapsoSignatureService,
        {
          provide: KapsoSyncService,
          useValue: syncServiceMock,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    repositoryMock.reserveWebhookReceipt.mockResolvedValue({
      acquired: true,
      payloadMismatch: false,
      phoneNumberId: PHONE_NUMBER_ID,
      status: "processing",
    });
    repositoryMock.completeWebhookReceipt.mockResolvedValue(undefined);
    repositoryMock.touchPhoneNumberWebhookEvent.mockResolvedValue(undefined);
    repositoryMock.recordWebhookSyncResult.mockResolvedValue(undefined);
    syncServiceMock.processInboundMessageWebhook.mockResolvedValue({
      processed: 1,
      answeredNo: 0,
      answeredYes: 0,
      introSent: 0,
      introFailed: 0,
      deliveryFailed: 1,
      deliveryConfirmed: 0,
      unidentifiedReplies: 0,
      ignored: 0,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("acepta un evento Kapso de fallo firmado con el secret de eventos", async () => {
    const payload = kapsoFailedMessagePayload();

    await request(app.getHttpServer())
      .post("/api/v1/webhooks/kapso/events")
      .set("x-idempotency-key", "kapso-failed-valid")
      .set("x-webhook-event", "whatsapp.message.failed")
      .set("x-webhook-signature", signPayload(payload, WEBHOOK_SECRETS.whatsapp))
      .send(payload)
      .expect(200)
      .expect({
        ok: true,
      });

    expect(syncServiceMock.processInboundMessageWebhook).toHaveBeenCalledWith(payload);
    expect(repositoryMock.completeWebhookReceipt).toHaveBeenCalledWith("kapso", "kapso-failed-valid", "processed", undefined);
  });

  it("rechaza un evento Kapso firmado con el secret de Meta", async () => {
    const payload = kapsoFailedMessagePayload();

    await request(app.getHttpServer())
      .post("/api/v1/webhooks/kapso/events")
      .set("x-idempotency-key", "kapso-failed-wrong-secret")
      .set("x-webhook-event", "whatsapp.message.failed")
      .set("x-webhook-signature", signPayload(payload, WEBHOOK_SECRETS.meta))
      .send(payload)
      .expect(401)
      .expect((response) => {
        expect(response.body.message).toBe("Firma de webhook de WhatsApp invalida.");
      });

    expect(repositoryMock.reserveWebhookReceipt).not.toHaveBeenCalled();
    expect(syncServiceMock.processInboundMessageWebhook).not.toHaveBeenCalled();
  });

  it("acepta un payload Meta de fallo firmado con el secret Meta", async () => {
    const payload = metaFailedMessagePayload();

    await request(app.getHttpServer())
      .post("/api/v1/webhooks/kapso/meta")
      .set("x-idempotency-key", "meta-failed-valid")
      .set("x-webhook-signature", signPayload(payload, WEBHOOK_SECRETS.meta))
      .send(payload)
      .expect(200)
      .expect({
        ok: true,
      });

    expect(syncServiceMock.processInboundMessageWebhook).toHaveBeenCalledWith(payload);
    expect(repositoryMock.completeWebhookReceipt).toHaveBeenCalledWith("meta", "meta-failed-valid", "processed", undefined);
  });

  it("rechaza un payload Meta firmado con el secret de eventos Kapso", async () => {
    const payload = metaFailedMessagePayload();

    await request(app.getHttpServer())
      .post("/api/v1/webhooks/kapso/meta")
      .set("x-idempotency-key", "meta-failed-wrong-secret")
      .set("x-webhook-signature", signPayload(payload, WEBHOOK_SECRETS.whatsapp))
      .send(payload)
      .expect(401)
      .expect((response) => {
        expect(response.body.message).toBe("Firma de webhook Meta invalida.");
      });

    expect(repositoryMock.reserveWebhookReceipt).not.toHaveBeenCalled();
    expect(syncServiceMock.processInboundMessageWebhook).not.toHaveBeenCalled();
  });
});
