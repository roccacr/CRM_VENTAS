// ============================================================================
// IMPORTS
// ============================================================================

import { ConfigService } from "@nestjs/config";

import { KapsoController } from "../../src/modules/kapso/controllers/kapso.controller";
import { KapsoRepository } from "../../src/modules/kapso/repositories/kapso.repository";
import { AdminKapsoIntegrationsRepository } from "../../src/modules/kapso/repositories/admin-kapso-integrations.repository";
import { KapsoPlatformApiService } from "../../src/modules/kapso/services/kapso-platform-api.service";
import { KapsoSyncService } from "../../src/modules/kapso/services/kapso-sync.service";

// ============================================================================
// CONSTANTES DE PRUEBA
// ============================================================================

const TEST_PHONE_NUMBER_ID = "1197677976762773";
const KAPSO_UNAVAILABLE_ERROR = new Error('Kapso API error: {"error":"WhatsApp configuration not found"}');

/** Detalle remoto simulado cuando Kapso ya expone el numero. */
const REMOTE_PHONE_NUMBER_DETAIL = {
  phoneNumberId: TEST_PHONE_NUMBER_ID,
  name: "RDG Ventas",
  displayPhoneNumber: "+506 7045 2242",
  verifiedName: "RDG Ventas",
  businessAccountId: "3174045732780123",
  status: "CONNECTED",
  qualityRating: "GREEN",
  throughputTier: "STANDARD",
  connectionType: "coexistence",
  customerId: "7ef8bba6-d140-4b57-a74f-3757f601b9a9",
  customerName: "CRM INTEGRACION",
  customerExternalId: null,
  projectId: "8067127b-c559-44ef-9f84-f20270911eec",
  projectName: "CRM VENTAS",
  projectPayload: {},
  customerPayload: {},
  raw: { id: TEST_PHONE_NUMBER_ID },
};

const ANSWERED_YES_CONTEXT = {
  executionId: 77,
  internalLeadId: 3095911,
  idnetsuiteAdmin: 653055,
  idProyectoNetsuite: 38,
  leadName: "PRUEBA ROBERTO OT",
  projectName: "Andira",
  phoneNumberId: TEST_PHONE_NUMBER_ID,
  leadPhoneNumber: "50687515938",
  projectExternalId: REMOTE_PHONE_NUMBER_DETAIL.projectId,
};

// ============================================================================
// HELPERS DE TEST
// ============================================================================

function createSyncServiceTestBed() {
  const configServiceMock = {
    get: jest.fn((key: string) => {
      if (key === "kapso.pendingSyncBatchSize") {
        return 10;
      }

      if (key === "kapso.pendingSyncIntervalMs") {
        return 30000;
      }

      if (key === "kapso.leadTemplateBatchSize") {
        return 100;
      }

      if (key === "kapso.leadTemplateIntervalMs") {
        return 60000;
      }

      return undefined;
    }),
  };

  const kapsoPlatformApiServiceMock = {
    getPhoneNumber: jest.fn(),
    listPhoneNumberWebhooks: jest.fn(),
    createKapsoPhoneNumberWebhook: jest.fn(),
    createMetaPhoneNumberWebhook: jest.fn(),
    sendWhatsappMessage: jest.fn(),
  };

  const kapsoRepositoryMock = {
    upsertPhoneNumber: jest.fn(),
    recordWebhookSyncResult: jest.fn(),
    listPendingRemoteSyncPhoneNumbers: jest.fn(),
    findPhoneNumberByExternalId: jest.fn(),
    listLeadTemplateCandidates: jest.fn(),
    markLeadTemplateCandidateSkipped: jest.fn(),
  };

  const adminKapsoIntegrationsRepositoryMock = {
    listLeadTemplateCandidates: kapsoRepositoryMock.listLeadTemplateCandidates,
    markLeadTemplateCandidateSkipped: kapsoRepositoryMock.markLeadTemplateCandidateSkipped,
    markLeadFlowAnsweredNo: jest.fn(),
    markLeadFlowAnsweredYes: jest.fn(),
    listActiveFlowProjectMedia: jest.fn(),
    markLeadFlowIntroSent: jest.fn(),
    markLeadFlowIntroFailed: jest.fn(),
  };

  const service = new KapsoSyncService(
    configServiceMock as unknown as ConfigService,
    kapsoPlatformApiServiceMock as unknown as KapsoPlatformApiService,
    kapsoRepositoryMock as unknown as KapsoRepository,
    adminKapsoIntegrationsRepositoryMock as unknown as AdminKapsoIntegrationsRepository,
  );

  return {
    service,
    kapsoPlatformApiServiceMock,
    kapsoRepositoryMock,
    adminKapsoIntegrationsRepositoryMock,
  };
}

function createKapsoControllerTestBed() {
  const kapsoSyncServiceMock = {
    bootstrapSync: jest.fn(),
    syncPhoneNumberById: jest.fn(),
  };

  const kapsoRepositoryMock = {
    listCustomers: jest.fn(),
    listPhoneNumbers: jest.fn(),
    recordSetupRedirect: jest.fn(),
  };

  const controller = new KapsoController(
    kapsoSyncServiceMock as unknown as KapsoSyncService,
    kapsoRepositoryMock as unknown as KapsoRepository,
  );

  return {
    controller,
    kapsoSyncServiceMock,
    kapsoRepositoryMock,
  };
}

// ============================================================================
// TESTS DEL SERVICIO DE SYNC
// ============================================================================

describe("KapsoSyncService", () => {
  let service: KapsoSyncService;
  let kapsoPlatformApiServiceMock: ReturnType<typeof createSyncServiceTestBed>["kapsoPlatformApiServiceMock"];
  let kapsoRepositoryMock: ReturnType<typeof createSyncServiceTestBed>["kapsoRepositoryMock"];

  beforeEach(() => {
    jest.clearAllMocks();

    const testBed = createSyncServiceTestBed();
    service = testBed.service;
    kapsoPlatformApiServiceMock = testBed.kapsoPlatformApiServiceMock;
    kapsoRepositoryMock = testBed.kapsoRepositoryMock;

    kapsoRepositoryMock.findPhoneNumberByExternalId.mockResolvedValue({
      phoneNumberId: TEST_PHONE_NUMBER_ID,
      projectExternalId: REMOTE_PHONE_NUMBER_DETAIL.projectId,
    });
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it("mantiene el numero en pending_remote_sync cuando Kapso aun no expone el detalle", async () => {
    kapsoRepositoryMock.listPendingRemoteSyncPhoneNumbers.mockResolvedValue([{ phoneNumberId: TEST_PHONE_NUMBER_ID }]);
    kapsoPlatformApiServiceMock.getPhoneNumber.mockRejectedValue(KAPSO_UNAVAILABLE_ERROR);
    kapsoPlatformApiServiceMock.listPhoneNumberWebhooks.mockResolvedValue([]);
    kapsoPlatformApiServiceMock.createKapsoPhoneNumberWebhook.mockResolvedValue({
      raw: { kind: "kapso" },
      kind: "kapso",
      events: [],
    });
    kapsoPlatformApiServiceMock.createMetaPhoneNumberWebhook.mockResolvedValue({
      raw: { kind: "meta" },
      kind: "meta",
      events: [],
    });
    kapsoRepositoryMock.recordWebhookSyncResult.mockResolvedValue({
      phoneNumberId: TEST_PHONE_NUMBER_ID,
      lastProcessingStatus: "pending_remote_sync",
    });

    const summary = await service.processPendingRemoteSyncs();

    expect(summary).toEqual({
      scanned: 1,
      recovered: 0,
      stillPending: 1,
      failed: 0,
    });
    expect(kapsoRepositoryMock.recordWebhookSyncResult).toHaveBeenCalledWith(
      TEST_PHONE_NUMBER_ID,
      "pending_remote_sync",
      'Kapso API error: {"error":"WhatsApp configuration not found"}',
      [{ kind: "kapso" }, { kind: "meta" }],
    );
    expect(kapsoPlatformApiServiceMock.createKapsoPhoneNumberWebhook).toHaveBeenCalledWith(TEST_PHONE_NUMBER_ID, {
      projectId: REMOTE_PHONE_NUMBER_DETAIL.projectId,
    });
    expect(kapsoPlatformApiServiceMock.createMetaPhoneNumberWebhook).toHaveBeenCalledWith(TEST_PHONE_NUMBER_ID, {
      projectId: REMOTE_PHONE_NUMBER_DETAIL.projectId,
    });
  });

  it("registra y descarta un lead sin asesor o sin asignacion Kapso", async () => {
    kapsoRepositoryMock.listLeadTemplateCandidates.mockResolvedValue([
      {
        leadId: 101,
        internalLeadId: 7001,
        idEmpleadoLead: 9001,
        adminId: 9001,
        adminName: "Asesor sin linea",
        kapsoRelationId: null,
        kapsoPhoneNumberId: null,
      },
      {
        leadId: 102,
        internalLeadId: 7002,
        idEmpleadoLead: null,
        adminId: null,
        adminName: null,
        kapsoRelationId: null,
        kapsoPhoneNumberId: null,
      },
    ]);
    kapsoRepositoryMock.markLeadTemplateCandidateSkipped.mockResolvedValue(true);

    const summary = await service.processLeadTemplateCandidates();

    expect(summary).toEqual({ scanned: 2, configured: 0, skipped: 2, failed: 0 });
    expect(kapsoRepositoryMock.markLeadTemplateCandidateSkipped).toHaveBeenCalledTimes(2);
    expect(kapsoRepositoryMock.markLeadTemplateCandidateSkipped).toHaveBeenNthCalledWith(1, 101, 7001, 9001, 1);
    expect(kapsoRepositoryMock.markLeadTemplateCandidateSkipped).toHaveBeenNthCalledWith(2, 102, 7002, 0, 1);
  });

  it("solo registra los leads con asesor y numero Kapso configurados sin enviarlos", async () => {
    kapsoRepositoryMock.listLeadTemplateCandidates.mockResolvedValue([
      {
        leadId: 103,
        internalLeadId: 7003,
        idEmpleadoLead: 9002,
        adminId: 9002,
        adminName: "Asesor configurado",
        kapsoRelationId: 8,
        kapsoPhoneNumberId: 14,
        phoneNumberId: "1197677976762773",
      },
    ]);

    const summary = await service.processLeadTemplateCandidates();

    expect(summary).toEqual({ scanned: 1, configured: 1, skipped: 0, failed: 0 });
    expect(kapsoRepositoryMock.markLeadTemplateCandidateSkipped).not.toHaveBeenCalled();
    expect(kapsoPlatformApiServiceMock.getPhoneNumber).not.toHaveBeenCalled();
  });

  it("evita dos corridas simultaneas del worker de leads", async () => {
    let releaseQuery!: () => void;
    const queryInProgress = new Promise<void>((resolve) => {
      releaseQuery = resolve;
    });
    kapsoRepositoryMock.listLeadTemplateCandidates.mockImplementationOnce(async () => {
      await queryInProgress;
      return [];
    });

    const firstRun = service.processLeadTemplateCandidates();
    const secondRun = await service.processLeadTemplateCandidates();

    expect(secondRun).toEqual({ scanned: 0, configured: 0, skipped: 0, failed: 0 });
    releaseQuery();
    await firstRun;
    expect(kapsoRepositoryMock.listLeadTemplateCandidates).toHaveBeenCalledTimes(1);
  });

  it("marca el flujo y el lead como perdido cuando el cliente toca No, gracias", async () => {
    const testBed = createSyncServiceTestBed();
    service = testBed.service;
    const repositoryMock = testBed.adminKapsoIntegrationsRepositoryMock;
    repositoryMock.markLeadFlowAnsweredNo.mockResolvedValue(true);

    const result = await service.processInboundMessageWebhook({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              value: {
                metadata: {
                  phone_number_id: TEST_PHONE_NUMBER_ID,
                },
                messages: [
                  {
                    from: "50687515938",
                    id: "wamid.no-response",
                    timestamp: "1783009759",
                    type: "button",
                    button: {
                      payload: "No, gracias",
                      text: "No, gracias",
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(result).toEqual({ processed: 1, answeredNo: 1, answeredYes: 0, introSent: 0, introFailed: 0, ignored: 0 });
    expect(repositoryMock.markLeadFlowAnsweredNo).toHaveBeenCalledWith({
      phoneNumberId: TEST_PHONE_NUMBER_ID,
      leadPhoneNumber: "50687515938",
      responsePayload: expect.objectContaining({
        messageId: "wamid.no-response",
        replyText: "No, gracias",
      }),
    });
    expect(repositoryMock.markLeadFlowAnsweredYes).not.toHaveBeenCalled();
  });

  it("marca el flujo como aceptado cuando el cliente toca Si, enviar informacion", async () => {
    const testBed = createSyncServiceTestBed();
    service = testBed.service;
    const repositoryMock = testBed.adminKapsoIntegrationsRepositoryMock;
    const platformApiMock = testBed.kapsoPlatformApiServiceMock;
    repositoryMock.markLeadFlowAnsweredYes.mockResolvedValue(ANSWERED_YES_CONTEXT);
    repositoryMock.listActiveFlowProjectMedia.mockResolvedValue([]);
    platformApiMock.sendWhatsappMessage.mockResolvedValue({ messages: [{ id: "wamid.intro" }] });

    const result = await service.processInboundMessageWebhook({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              value: {
                metadata: {
                  phone_number_id: TEST_PHONE_NUMBER_ID,
                },
                messages: [
                  {
                    from: "50687515938",
                    id: "wamid.yes-response",
                    timestamp: "1783009760",
                    type: "button",
                    button: {
                      payload: "Sí, enviar información",
                      text: "Sí, enviar información",
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(result).toEqual({ processed: 1, answeredNo: 0, answeredYes: 1, introSent: 1, introFailed: 0, ignored: 0 });
    expect(repositoryMock.markLeadFlowAnsweredYes).toHaveBeenCalledWith({
      phoneNumberId: TEST_PHONE_NUMBER_ID,
      leadPhoneNumber: "50687515938",
      responsePayload: expect.objectContaining({
        messageId: "wamid.yes-response",
        replyText: "Sí, enviar información",
      }),
    });
    expect(repositoryMock.markLeadFlowAnsweredNo).not.toHaveBeenCalled();
    expect(repositoryMock.listActiveFlowProjectMedia).toHaveBeenCalledWith("94d5c3b8-4b43-4c28-8c76-3d9eaf70ad01", 38, "intro");
    expect(platformApiMock.sendWhatsappMessage).toHaveBeenCalledWith(
      TEST_PHONE_NUMBER_ID,
      expect.objectContaining({
        to: "50687515938",
        type: "interactive",
        interactive: expect.objectContaining({
          type: "button",
          body: expect.objectContaining({
            text: expect.stringContaining("Perfecto PRUEBA ROBERTO OT"),
          }),
        }),
      }),
      { projectId: REMOTE_PHONE_NUMBER_DETAIL.projectId },
    );
    expect(repositoryMock.markLeadFlowIntroSent).toHaveBeenCalledWith({ executionId: 77 });
  });

  it("envia adjuntos de intro antes del mensaje interactivo cuando el proyecto tiene media", async () => {
    const testBed = createSyncServiceTestBed();
    service = testBed.service;
    const repositoryMock = testBed.adminKapsoIntegrationsRepositoryMock;
    const platformApiMock = testBed.kapsoPlatformApiServiceMock;
    repositoryMock.markLeadFlowAnsweredYes.mockResolvedValue(ANSWERED_YES_CONTEXT);
    repositoryMock.listActiveFlowProjectMedia.mockResolvedValue([
      {
        id: 1,
        flowUuid: "94d5c3b8-4b43-4c28-8c76-3d9eaf70ad01",
        idProyectoNetsuite: 38,
        projectName: "Andira",
        stepCode: "intro",
        mediaType: "video",
        originalName: "intro.mp4",
        storedFilename: "intro.mp4",
        relativePath: "flow/38/intro/intro.mp4",
        publicUrl: "https://crm.example.com/api/v1/kapso/media/intro.mp4",
        mimeType: "video/mp4",
        fileSize: 1234,
        sortOrder: 1,
        active: true,
      },
      {
        id: 2,
        flowUuid: "94d5c3b8-4b43-4c28-8c76-3d9eaf70ad01",
        idProyectoNetsuite: 38,
        projectName: "Andira",
        stepCode: "intro",
        mediaType: "image",
        originalName: "foto.jpg",
        storedFilename: "foto.jpg",
        relativePath: "flow/38/intro/foto.jpg",
        publicUrl: "https://crm.example.com/api/v1/kapso/media/foto.jpg",
        mimeType: "image/jpeg",
        fileSize: 567,
        sortOrder: 2,
        active: true,
      },
    ]);
    platformApiMock.sendWhatsappMessage.mockResolvedValue({ messages: [{ id: "wamid.sent" }] });

    const result = await service.processInboundMessageWebhook({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: TEST_PHONE_NUMBER_ID },
                messages: [
                  {
                    from: "50687515938",
                    id: "wamid.yes-media-response",
                    timestamp: "1783009761",
                    type: "button",
                    button: {
                      payload: "Sí, enviar información",
                      text: "Sí, enviar información",
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(result).toEqual({ processed: 1, answeredNo: 0, answeredYes: 1, introSent: 1, introFailed: 0, ignored: 0 });
    expect(platformApiMock.sendWhatsappMessage).toHaveBeenCalledTimes(3);
    expect(platformApiMock.sendWhatsappMessage).toHaveBeenNthCalledWith(
      1,
      TEST_PHONE_NUMBER_ID,
      expect.objectContaining({
        type: "video",
        video: { link: "https://crm.example.com/api/v1/kapso/media/intro.mp4" },
      }),
      { projectId: REMOTE_PHONE_NUMBER_DETAIL.projectId },
    );
    expect(platformApiMock.sendWhatsappMessage).toHaveBeenNthCalledWith(
      2,
      TEST_PHONE_NUMBER_ID,
      expect.objectContaining({
        type: "image",
        image: { link: "https://crm.example.com/api/v1/kapso/media/foto.jpg" },
      }),
      { projectId: REMOTE_PHONE_NUMBER_DETAIL.projectId },
    );
    expect(platformApiMock.sendWhatsappMessage).toHaveBeenNthCalledWith(
      3,
      TEST_PHONE_NUMBER_ID,
      expect.objectContaining({ type: "interactive" }),
      { projectId: REMOTE_PHONE_NUMBER_DETAIL.projectId },
    );
    expect(repositoryMock.markLeadFlowIntroSent).toHaveBeenCalledWith({ executionId: 77 });
  });

  it("marca intro_failed si Kapso no permite enviar el mensaje normal de intro", async () => {
    const testBed = createSyncServiceTestBed();
    service = testBed.service;
    const repositoryMock = testBed.adminKapsoIntegrationsRepositoryMock;
    const platformApiMock = testBed.kapsoPlatformApiServiceMock;
    repositoryMock.markLeadFlowAnsweredYes.mockResolvedValue(ANSWERED_YES_CONTEXT);
    repositoryMock.listActiveFlowProjectMedia.mockResolvedValue([]);
    platformApiMock.sendWhatsappMessage.mockRejectedValue(new Error("Kapso send failed"));

    const result = await service.processInboundMessageWebhook({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: TEST_PHONE_NUMBER_ID },
                messages: [
                  {
                    from: "50687515938",
                    id: "wamid.yes-failed-response",
                    timestamp: "1783009762",
                    type: "button",
                    button: {
                      payload: "Sí, enviar información",
                      text: "Sí, enviar información",
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(result).toEqual({ processed: 1, answeredNo: 0, answeredYes: 1, introSent: 0, introFailed: 1, ignored: 0 });
    expect(repositoryMock.markLeadFlowIntroFailed).toHaveBeenCalledWith({
      executionId: 77,
      failureReason: "Kapso send failed",
    });
  });

  it("marca el flujo y el lead como perdido cuando el cliente escribe No, gracias exacto", async () => {
    const testBed = createSyncServiceTestBed();
    service = testBed.service;
    const repositoryMock = testBed.adminKapsoIntegrationsRepositoryMock;
    repositoryMock.markLeadFlowAnsweredNo.mockResolvedValue(true);

    const result = await service.processInboundMessageWebhook({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              value: {
                metadata: {
                  phone_number_id: TEST_PHONE_NUMBER_ID,
                },
                messages: [
                  {
                    from: "50687515938",
                    id: "wamid.free-text",
                    timestamp: "1783009759",
                    type: "text",
                    text: {
                      body: "No gracias",
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(result).toEqual({ processed: 1, answeredNo: 1, answeredYes: 0, introSent: 0, introFailed: 0, ignored: 0 });
    expect(repositoryMock.markLeadFlowAnsweredNo).toHaveBeenCalledWith({
      phoneNumberId: TEST_PHONE_NUMBER_ID,
      leadPhoneNumber: "50687515938",
      responsePayload: expect.objectContaining({
        messageId: "wamid.free-text",
        replyText: "No gracias",
        replySource: "text",
      }),
    });
    expect(repositoryMock.markLeadFlowAnsweredYes).not.toHaveBeenCalled();
  });

  it("marca el flujo como aceptado cuando el cliente escribe Si, enviar informacion exacto", async () => {
    const testBed = createSyncServiceTestBed();
    service = testBed.service;
    const repositoryMock = testBed.adminKapsoIntegrationsRepositoryMock;
    const platformApiMock = testBed.kapsoPlatformApiServiceMock;
    repositoryMock.markLeadFlowAnsweredYes.mockResolvedValue(ANSWERED_YES_CONTEXT);
    repositoryMock.listActiveFlowProjectMedia.mockResolvedValue([]);
    platformApiMock.sendWhatsappMessage.mockResolvedValue({ messages: [{ id: "wamid.intro-text" }] });

    const result = await service.processInboundMessageWebhook({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              value: {
                metadata: {
                  phone_number_id: TEST_PHONE_NUMBER_ID,
                },
                messages: [
                  {
                    from: "50687515938",
                    id: "wamid.free-text-yes",
                    timestamp: "1783009760",
                    type: "text",
                    text: {
                      body: "Si, enviar informacion",
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(result).toEqual({ processed: 1, answeredNo: 0, answeredYes: 1, introSent: 1, introFailed: 0, ignored: 0 });
    expect(repositoryMock.markLeadFlowAnsweredNo).not.toHaveBeenCalled();
    expect(repositoryMock.markLeadFlowAnsweredYes).toHaveBeenCalledWith({
      phoneNumberId: TEST_PHONE_NUMBER_ID,
      leadPhoneNumber: "50687515938",
      responsePayload: expect.objectContaining({
        messageId: "wamid.free-text-yes",
        replyText: "Si, enviar informacion",
        replySource: "text",
      }),
    });
    expect(repositoryMock.markLeadFlowIntroSent).toHaveBeenCalledWith({ executionId: 77 });
  });

  it("ignora texto libre ambiguo para evitar falsos avances o falsos perdidos", async () => {
    const testBed = createSyncServiceTestBed();
    service = testBed.service;
    const repositoryMock = testBed.adminKapsoIntegrationsRepositoryMock;

    const result = await service.processInboundMessageWebhook({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              value: {
                metadata: {
                  phone_number_id: TEST_PHONE_NUMBER_ID,
                },
                messages: [
                  {
                    from: "50687515938",
                    id: "wamid.free-text-ambiguous",
                    timestamp: "1783009763",
                    type: "text",
                    text: {
                      body: "No estoy seguro, talvez si despues me manda algo",
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(result).toEqual({ processed: 1, answeredNo: 0, answeredYes: 0, introSent: 0, introFailed: 0, ignored: 1 });
    expect(repositoryMock.markLeadFlowAnsweredNo).not.toHaveBeenCalled();
    expect(repositoryMock.markLeadFlowAnsweredYes).not.toHaveBeenCalled();
  });

  it("no aborta el sync parcial si la creacion de un webhook falla", async () => {
    kapsoRepositoryMock.listPendingRemoteSyncPhoneNumbers.mockResolvedValue([{ phoneNumberId: TEST_PHONE_NUMBER_ID }]);
    kapsoPlatformApiServiceMock.getPhoneNumber.mockRejectedValue(KAPSO_UNAVAILABLE_ERROR);
    kapsoPlatformApiServiceMock.listPhoneNumberWebhooks.mockResolvedValue([]);
    kapsoPlatformApiServiceMock.createKapsoPhoneNumberWebhook.mockResolvedValue({
      raw: { kind: "kapso" },
      kind: "kapso",
      events: [],
    });
    kapsoPlatformApiServiceMock.createMetaPhoneNumberWebhook.mockRejectedValue(new Error("timeout of 10000ms exceeded"));
    kapsoRepositoryMock.recordWebhookSyncResult.mockResolvedValue({
      phoneNumberId: TEST_PHONE_NUMBER_ID,
      lastProcessingStatus: "pending_remote_sync",
    });

    const summary = await service.processPendingRemoteSyncs();

    expect(summary).toEqual({
      scanned: 1,
      recovered: 0,
      stillPending: 1,
      failed: 0,
    });
    expect(kapsoRepositoryMock.recordWebhookSyncResult).toHaveBeenCalledWith(
      TEST_PHONE_NUMBER_ID,
      "pending_remote_sync",
      expect.stringContaining('Kapso API error: {"error":"WhatsApp configuration not found"}'),
      [{ kind: "kapso" }],
    );
    expect(kapsoPlatformApiServiceMock.createKapsoPhoneNumberWebhook).toHaveBeenCalledWith(TEST_PHONE_NUMBER_ID, {
      projectId: REMOTE_PHONE_NUMBER_DETAIL.projectId,
    });
  });

  it("completa la sincronizacion y asegura ambos webhooks cuando Kapso ya responde", async () => {
    kapsoRepositoryMock.listPendingRemoteSyncPhoneNumbers.mockResolvedValue([{ phoneNumberId: TEST_PHONE_NUMBER_ID }]);
    kapsoPlatformApiServiceMock.getPhoneNumber.mockResolvedValue(REMOTE_PHONE_NUMBER_DETAIL);
    kapsoRepositoryMock.upsertPhoneNumber.mockResolvedValue({
      phoneNumberId: TEST_PHONE_NUMBER_ID,
      projectExternalId: REMOTE_PHONE_NUMBER_DETAIL.projectId,
    });
    kapsoRepositoryMock.recordWebhookSyncResult.mockResolvedValue({
      phoneNumberId: TEST_PHONE_NUMBER_ID,
      setupSyncStatus: "processed",
      lastProcessingStatus: "processed",
    });
    kapsoPlatformApiServiceMock.listPhoneNumberWebhooks.mockResolvedValue([]);
    kapsoPlatformApiServiceMock.createKapsoPhoneNumberWebhook.mockResolvedValue({
      raw: { kind: "kapso" },
      kind: "kapso",
      events: [],
    });
    kapsoPlatformApiServiceMock.createMetaPhoneNumberWebhook.mockResolvedValue({
      raw: { kind: "meta" },
      kind: "meta",
      events: [],
    });

    const summary = await service.processPendingRemoteSyncs();

    expect(summary).toEqual({
      scanned: 1,
      recovered: 1,
      stillPending: 0,
      failed: 0,
    });
    expect(kapsoPlatformApiServiceMock.createKapsoPhoneNumberWebhook).toHaveBeenCalledWith(TEST_PHONE_NUMBER_ID, {
      projectId: REMOTE_PHONE_NUMBER_DETAIL.projectId,
    });
    expect(kapsoPlatformApiServiceMock.createMetaPhoneNumberWebhook).toHaveBeenCalledWith(TEST_PHONE_NUMBER_ID, {
      projectId: REMOTE_PHONE_NUMBER_DETAIL.projectId,
    });
    expect(kapsoRepositoryMock.recordWebhookSyncResult).toHaveBeenCalledWith(TEST_PHONE_NUMBER_ID, "processed", null, [
      { kind: "kapso" },
      { kind: "meta" },
    ]);
  });

  it("marca processed_with_warnings cuando el detalle llega pero un webhook falla", async () => {
    kapsoRepositoryMock.listPendingRemoteSyncPhoneNumbers.mockResolvedValue([{ phoneNumberId: TEST_PHONE_NUMBER_ID }]);
    kapsoPlatformApiServiceMock.getPhoneNumber.mockResolvedValue(REMOTE_PHONE_NUMBER_DETAIL);
    kapsoRepositoryMock.upsertPhoneNumber.mockResolvedValue({
      phoneNumberId: TEST_PHONE_NUMBER_ID,
      projectExternalId: REMOTE_PHONE_NUMBER_DETAIL.projectId,
    });
    kapsoRepositoryMock.recordWebhookSyncResult.mockResolvedValue({
      phoneNumberId: TEST_PHONE_NUMBER_ID,
      setupSyncStatus: "processed_with_warnings",
      lastProcessingStatus: "processed_with_warnings",
    });
    kapsoPlatformApiServiceMock.listPhoneNumberWebhooks.mockResolvedValue([]);
    kapsoPlatformApiServiceMock.createKapsoPhoneNumberWebhook.mockResolvedValue({
      raw: { kind: "kapso" },
      kind: "kapso",
      events: [],
    });
    kapsoPlatformApiServiceMock.createMetaPhoneNumberWebhook.mockRejectedValue(new Error("timeout of 10000ms exceeded"));

    const summary = await service.processPendingRemoteSyncs();

    expect(summary).toEqual({
      scanned: 1,
      recovered: 1,
      stillPending: 0,
      failed: 0,
    });
    expect(kapsoRepositoryMock.recordWebhookSyncResult).toHaveBeenCalledWith(
      TEST_PHONE_NUMBER_ID,
      "processed_with_warnings",
      expect.stringContaining("No se pudo crear webhook Meta"),
      [{ kind: "kapso" }],
    );
    expect(kapsoPlatformApiServiceMock.createKapsoPhoneNumberWebhook).toHaveBeenCalledWith(TEST_PHONE_NUMBER_ID, {
      projectId: REMOTE_PHONE_NUMBER_DETAIL.projectId,
    });
  });
});

// ============================================================================
// TESTS DEL CONTROLADOR DE SETUP
// ============================================================================

describe("KapsoController", () => {
  let controller: KapsoController;
  let kapsoSyncServiceMock: ReturnType<typeof createKapsoControllerTestBed>["kapsoSyncServiceMock"];
  let kapsoRepositoryMock: ReturnType<typeof createKapsoControllerTestBed>["kapsoRepositoryMock"];

  beforeEach(() => {
    jest.clearAllMocks();

    const testBed = createKapsoControllerTestBed();
    controller = testBed.controller;
    kapsoSyncServiceMock = testBed.kapsoSyncServiceMock;
    kapsoRepositoryMock = testBed.kapsoRepositoryMock;

    kapsoRepositoryMock.recordSetupRedirect.mockResolvedValue(null);
  });

  it("muestra sincronizacion pendiente cuando Kapso aun no expone el detalle remoto", async () => {
    kapsoSyncServiceMock.syncPhoneNumberById.mockResolvedValue({
      setupSyncStatus: "pending_remote_sync",
      lastProcessingStatus: "pending_remote_sync",
      setupSyncError: 'Kapso API error: {"error":"WhatsApp configuration not found"}',
    });

    const html = await controller.handleSetupSuccess({
      phone_number_id: TEST_PHONE_NUMBER_ID,
      setup_link_id: "setup-001",
      business_account_id: "3174045732780123",
      whatsapp_config_id: "config-001",
    });

    expect(html).toContain("Sincronizacion pendiente");
    expect(html).toContain("el API seguira reintentando automaticamente hasta completar el detalle remoto y los webhooks");
    expect(kapsoRepositoryMock.recordSetupRedirect).toHaveBeenLastCalledWith(
      expect.objectContaining({
        phoneNumberId: TEST_PHONE_NUMBER_ID,
        syncStatus: "pending_remote_sync",
      }),
    );
  });

  it("muestra sincronizacion pendiente cuando los webhooks aun no estan confirmados", async () => {
    kapsoSyncServiceMock.syncPhoneNumberById.mockResolvedValue({
      setupSyncStatus: "processed_with_warnings",
      lastProcessingStatus: "processed_with_warnings",
      setupSyncError: "No se pudo crear webhook Meta",
    });

    const html = await controller.handleSetupSuccess({
      phone_number_id: TEST_PHONE_NUMBER_ID,
      setup_link_id: "setup-002",
      business_account_id: "3174045732780123",
      whatsapp_config_id: "config-002",
    });

    expect(html).toContain("Sincronizacion pendiente");
    expect(html).toContain("el API seguira reintentando automaticamente hasta confirmar los webhooks requeridos");
    expect(kapsoRepositoryMock.recordSetupRedirect).toHaveBeenLastCalledWith(
      expect.objectContaining({
        phoneNumberId: TEST_PHONE_NUMBER_ID,
        syncStatus: "processed_with_warnings",
      }),
    );
  });

  it("muestra exito solo cuando el numero y los webhooks ya fueron confirmados", async () => {
    kapsoSyncServiceMock.syncPhoneNumberById.mockResolvedValue({
      setupSyncStatus: "processed",
      lastProcessingStatus: "processed",
      setupSyncError: null,
    });

    const html = await controller.handleSetupSuccess({
      phone_number_id: TEST_PHONE_NUMBER_ID,
      setup_link_id: "setup-003",
      business_account_id: "3174045732780123",
      whatsapp_config_id: "config-003",
    });

    expect(html).toContain("WhatsApp conectado");
    expect(html).toContain("la sincronizacion local fue confirmada");
    expect(html).toContain(`Numero sincronizado correctamente: ${TEST_PHONE_NUMBER_ID}`);
    expect(kapsoRepositoryMock.recordSetupRedirect).toHaveBeenLastCalledWith(
      expect.objectContaining({
        phoneNumberId: TEST_PHONE_NUMBER_ID,
        syncStatus: "processed",
      }),
    );
  });

  it("muestra fallo terminal cuando la sincronizacion devuelve un error no recuperable", async () => {
    kapsoSyncServiceMock.syncPhoneNumberById.mockRejectedValue(new Error('Kapso API error: {"error":"Forbidden"}'));

    const html = await controller.handleSetupSuccess({
      phone_number_id: TEST_PHONE_NUMBER_ID,
      setup_link_id: "setup-004",
      business_account_id: "3174045732780123",
      whatsapp_config_id: "config-004",
    });

    expect(html).toContain("Sincronizacion fallida");
    expect(html).toContain('la sincronizacion fallo: Kapso API error: {"error":"Forbidden"}');
    expect(kapsoRepositoryMock.recordSetupRedirect).toHaveBeenLastCalledWith(
      expect.objectContaining({
        phoneNumberId: TEST_PHONE_NUMBER_ID,
        syncStatus: "sync_failed",
      }),
    );
  });
});
