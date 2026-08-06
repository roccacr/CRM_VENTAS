// ============================================================================
// IMPORTS
// ============================================================================

import { ConfigService } from "@nestjs/config";

import { KapsoController } from "../../src/modules/kapso/controllers/kapso.controller";
import { KapsoRepository } from "../../src/modules/kapso/repositories/kapso.repository";
import { KapsoFlowProjectMediaRepository } from "../../src/modules/kapso/repositories/kapso-flow-project-media.repository";
import { KapsoLeadAutomationRepository } from "../../src/modules/kapso/repositories/kapso-lead-automation.repository";
import { KapsoLeadAutomationService } from "../../src/modules/kapso/services/kapso-lead-automation.service";
import { KapsoMediaUrlSignerService } from "../../src/modules/kapso/services/kapso-media-url-signer.service";
import { KapsoPhoneNumberSyncService } from "../../src/modules/kapso/services/kapso-phone-number-sync.service";
import { KapsoPlatformApiService } from "../../src/modules/kapso/services/kapso-platform-api.service";
import { KapsoSyncService } from "../../src/modules/kapso/services/kapso-sync.service";

// ============================================================================
// CONSTANTES DE PRUEBA
// ============================================================================

const TEST_PHONE_NUMBER_ID = "1197677976762773";
const LEAD_INITIAL_CONTACT_FLOW_UUID = "94d5c3b8-4b43-4c28-8c76-3d9eaf70ad01";
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
  flowUuid: LEAD_INITIAL_CONTACT_FLOW_UUID,
  internalLeadId: 3095911,
  idnetsuiteAdmin: 653055,
  idProyectoNetsuite: 38,
  leadName: "Nombre del lead",
  projectName: "Andira",
  adminName: "Roberto Carlos Zuniga",
  phoneNumberId: TEST_PHONE_NUMBER_ID,
  leadPhoneNumber: "50687515938",
  projectExternalId: REMOTE_PHONE_NUMBER_DETAIL.projectId,
  introMessageTemplate: null,
  introOptionsJson: null,
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
    markLeadTemplateCandidateInvalidPhone: jest.fn(),
    reserveInitialTemplateSend: jest.fn(),
    markInitialTemplateSent: jest.fn(),
    markInitialTemplateFailed: jest.fn(),
    markInitialTemplateDeliveryFailed: jest.fn(),
    markInitialTemplateDeliverySucceeded: jest.fn(),
    markLeadFlowIntroMediaDelivered: jest.fn(),
    markLeadFlowIntroMediaFailed: jest.fn(),
    markLeadFlowIntroMediaPending: jest.fn(),
  };

  const adminKapsoIntegrationsRepositoryMock = {
    listLeadTemplateCandidates: kapsoRepositoryMock.listLeadTemplateCandidates,
    markLeadTemplateCandidateSkipped: kapsoRepositoryMock.markLeadTemplateCandidateSkipped,
    markLeadTemplateCandidateInvalidPhone: kapsoRepositoryMock.markLeadTemplateCandidateInvalidPhone,
    reserveInitialTemplateSend: kapsoRepositoryMock.reserveInitialTemplateSend,
    markInitialTemplateSent: kapsoRepositoryMock.markInitialTemplateSent,
    markInitialTemplateFailed: kapsoRepositoryMock.markInitialTemplateFailed,
    markInitialTemplateDeliveryFailed: kapsoRepositoryMock.markInitialTemplateDeliveryFailed,
    markInitialTemplateDeliverySucceeded: kapsoRepositoryMock.markInitialTemplateDeliverySucceeded,
    markLeadFlowIntroMediaDelivered: kapsoRepositoryMock.markLeadFlowIntroMediaDelivered,
    markLeadFlowIntroMediaFailed: kapsoRepositoryMock.markLeadFlowIntroMediaFailed,
    markLeadFlowIntroMediaPending: kapsoRepositoryMock.markLeadFlowIntroMediaPending,
    markLeadFlowAnsweredNo: jest.fn(),
    markLeadFlowAnsweredYes: jest.fn(),
    findLeadFlowIntroOptionContext: jest.fn(),
    markLeadFlowIntroOptionAnswered: jest.fn(),
    registerUnidentifiedInitialReply: jest.fn(),
    listActiveFlowProjectMedia: jest.fn(),
    markLeadFlowIntroSent: jest.fn(),
    markLeadFlowIntroFailed: jest.fn(),
  };

  const mediaUrlSignerMock = {
    createSignedUrl: jest.fn((storedFilename: string) => `https://crm.example.com/media/${storedFilename}?signed=true`),
  };

  const phoneNumberSyncService = new KapsoPhoneNumberSyncService(
    configServiceMock as unknown as ConfigService,
    kapsoPlatformApiServiceMock as unknown as KapsoPlatformApiService,
    kapsoRepositoryMock as unknown as KapsoRepository,
  );
  const leadAutomationService = new KapsoLeadAutomationService(
    configServiceMock as unknown as ConfigService,
    kapsoPlatformApiServiceMock as unknown as KapsoPlatformApiService,
    adminKapsoIntegrationsRepositoryMock as unknown as KapsoLeadAutomationRepository,
    adminKapsoIntegrationsRepositoryMock as unknown as KapsoFlowProjectMediaRepository,
    mediaUrlSignerMock as unknown as KapsoMediaUrlSignerService,
  );
  const service = new KapsoSyncService(phoneNumberSyncService, leadAutomationService);

  return {
    service,
    kapsoPlatformApiServiceMock,
    kapsoRepositoryMock,
    adminKapsoIntegrationsRepositoryMock,
    mediaUrlSignerMock,
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

    expect(summary).toEqual({ scanned: 2, configured: 0, sent: 0, skipped: 2, failed: 0 });
    expect(kapsoRepositoryMock.markLeadTemplateCandidateSkipped).toHaveBeenCalledTimes(2);
    expect(kapsoRepositoryMock.markLeadTemplateCandidateSkipped).toHaveBeenNthCalledWith(1, 101, 7001, 9001, 1);
    expect(kapsoRepositoryMock.markLeadTemplateCandidateSkipped).toHaveBeenNthCalledWith(2, 102, 7002, 0, 1);
  });

  it("reserva y envia el template inicial cuando el lead tiene asesor, numero, proyecto y template aprobados", async () => {
    kapsoRepositoryMock.listLeadTemplateCandidates.mockResolvedValue([
      {
        leadId: 103,
        internalLeadId: 3095911,
        idEmpleadoLead: 653055,
        adminId: 653055,
        adminName: "Roberto Carlos Zuniga Altamirano",
        kapsoRelationId: 8,
        kapsoPhoneNumberId: 14,
        phoneNumberId: TEST_PHONE_NUMBER_ID,
        leadPhoneNumberRaw: "50687515938",
        nombre_lead: "Nombre del lead",
        idProyectoNetsuite: 38,
        projectName: "Andira",
        projectExternalId: REMOTE_PHONE_NUMBER_DETAIL.projectId,
        flowUuid: LEAD_INITIAL_CONTACT_FLOW_UUID,
        templateName: "saludo",
        templateLanguage: "es_ES",
        templateStatus: "approved",
      },
    ]);
    kapsoRepositoryMock.reserveInitialTemplateSend.mockResolvedValue({ executionId: 44 });
    kapsoPlatformApiServiceMock.sendWhatsappMessage.mockResolvedValue({ messages: [{ id: "wamid.saludo" }] });

    const summary = await service.processLeadTemplateCandidates();

    expect(summary).toEqual({ scanned: 1, configured: 1, sent: 1, skipped: 0, failed: 0 });
    expect(kapsoRepositoryMock.markLeadTemplateCandidateSkipped).not.toHaveBeenCalled();
    expect(kapsoRepositoryMock.reserveInitialTemplateSend).toHaveBeenCalledWith({
      flowUuid: LEAD_INITIAL_CONTACT_FLOW_UUID,
      leadId: 103,
      internalLeadId: 3095911,
      idnetsuiteAdmin: 653055,
      idProyectoNetsuite: 38,
      phoneNumberId: TEST_PHONE_NUMBER_ID,
      leadPhoneNumber: "50687515938",
    });
    expect(kapsoPlatformApiServiceMock.sendWhatsappMessage).toHaveBeenCalledWith(
      TEST_PHONE_NUMBER_ID,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: "50687515938",
        type: "template",
        template: {
          name: "saludo",
          language: { code: "es_ES" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: "Nombre del lead" },
                { type: "text", text: "Roberto Carlos Zuniga Altamirano" },
                { type: "text", text: "Andira" },
              ],
            },
          ],
        },
      },
      { projectId: REMOTE_PHONE_NUMBER_DETAIL.projectId },
    );
    expect(kapsoRepositoryMock.markInitialTemplateSent).toHaveBeenCalledWith({
      executionId: 44,
      messageId: "wamid.saludo",
      responsePayload: { messages: [{ id: "wamid.saludo" }] },
    });
  });

  it("descarta el candidato y registra bitacora cuando el telefono no es valido", async () => {
    kapsoRepositoryMock.listLeadTemplateCandidates.mockResolvedValue([
      {
        leadId: 103,
        internalLeadId: 3095911,
        idEmpleadoLead: 653055,
        adminId: 653055,
        adminName: "Roberto Carlos Zuniga Altamirano",
        kapsoRelationId: 8,
        kapsoPhoneNumberId: 14,
        phoneNumberId: TEST_PHONE_NUMBER_ID,
        leadPhoneNumberRaw: "telefono malo",
        nombre_lead: "Nombre del lead",
        idProyectoNetsuite: 38,
        projectName: "Andira",
        projectExternalId: REMOTE_PHONE_NUMBER_DETAIL.projectId,
        flowUuid: LEAD_INITIAL_CONTACT_FLOW_UUID,
        templateName: "saludo",
        templateLanguage: "es_ES",
        templateStatus: "approved",
      },
    ]);
    kapsoRepositoryMock.markLeadTemplateCandidateInvalidPhone.mockResolvedValue(true);

    const summary = await service.processLeadTemplateCandidates();

    expect(summary).toEqual({ scanned: 1, configured: 0, sent: 0, skipped: 1, failed: 0 });
    expect(kapsoRepositoryMock.markLeadTemplateCandidateInvalidPhone).toHaveBeenCalledWith({
      flowUuid: LEAD_INITIAL_CONTACT_FLOW_UUID,
      leadId: 103,
      internalLeadId: 3095911,
      idnetsuiteAdmin: 653055,
      idProyectoNetsuite: 38,
      phoneNumberId: TEST_PHONE_NUMBER_ID,
      leadPhoneNumber: "telefono malo",
      leadStatus: 1,
    });
    expect(kapsoRepositoryMock.reserveInitialTemplateSend).not.toHaveBeenCalled();
    expect(kapsoPlatformApiServiceMock.sendWhatsappMessage).not.toHaveBeenCalled();
  });

  it("marca la ejecucion como fallida cuando Kapso rechaza el envio inicial", async () => {
    kapsoRepositoryMock.listLeadTemplateCandidates.mockResolvedValue([
      {
        leadId: 103,
        internalLeadId: 3095911,
        idEmpleadoLead: 653055,
        adminId: 653055,
        adminName: "Roberto Carlos Zuniga Altamirano",
        kapsoRelationId: 8,
        kapsoPhoneNumberId: 14,
        phoneNumberId: TEST_PHONE_NUMBER_ID,
        leadPhoneNumberRaw: "50687515938",
        nombre_lead: "Nombre del lead",
        idProyectoNetsuite: 38,
        projectName: "Andira",
        projectExternalId: REMOTE_PHONE_NUMBER_DETAIL.projectId,
        flowUuid: LEAD_INITIAL_CONTACT_FLOW_UUID,
        templateName: "saludo",
        templateLanguage: "es_ES",
        templateStatus: "approved",
      },
    ]);
    kapsoRepositoryMock.reserveInitialTemplateSend.mockResolvedValue({ executionId: 44 });
    kapsoPlatformApiServiceMock.sendWhatsappMessage.mockRejectedValue(new Error("Kapso send failed"));

    const summary = await service.processLeadTemplateCandidates();

    expect(summary).toEqual({ scanned: 1, configured: 1, sent: 0, skipped: 0, failed: 1 });
    expect(kapsoRepositoryMock.markInitialTemplateFailed).toHaveBeenCalledWith({
      executionId: 44,
      failureReason: "Kapso send failed",
    });
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

    expect(secondRun).toEqual({ scanned: 0, configured: 0, sent: 0, skipped: 0, failed: 0 });
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

    expect(result).toEqual({
      processed: 1,
      answeredNo: 1,
      answeredYes: 0,
      introSent: 0,
      introPending: 0,
      introFailed: 0,
      deliveryFailed: 0,
      deliveryConfirmed: 0,
      unidentifiedReplies: 0,
      ignored: 0,
    });
    expect(repositoryMock.markLeadFlowAnsweredNo).toHaveBeenCalledWith({
      phoneNumberId: TEST_PHONE_NUMBER_ID,
      leadPhoneNumber: "50687515938",
      contextMessageId: null,
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

    expect(result).toEqual({
      processed: 1,
      answeredNo: 0,
      answeredYes: 1,
      introSent: 1,
      introPending: 0,
      introFailed: 0,
      deliveryFailed: 0,
      deliveryConfirmed: 0,
      unidentifiedReplies: 0,
      ignored: 0,
    });
    expect(repositoryMock.markLeadFlowAnsweredYes).toHaveBeenCalledWith({
      phoneNumberId: TEST_PHONE_NUMBER_ID,
      leadPhoneNumber: "50687515938",
      contextMessageId: null,
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
            text: expect.stringContaining("Perfecto Nombre del lead"),
          }),
        }),
      }),
      { projectId: REMOTE_PHONE_NUMBER_DETAIL.projectId },
    );
    expect(repositoryMock.markLeadFlowIntroSent).toHaveBeenCalledWith({
      executionId: 77,
      messageId: "wamid.intro",
    });
  });

  it("deja pendiente el mensaje interactivo hasta confirmar todos los adjuntos de intro", async () => {
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
    platformApiMock.sendWhatsappMessage
      .mockResolvedValueOnce({ messages: [{ id: "wamid.media-video" }] })
      .mockResolvedValueOnce({ messages: [{ id: "wamid.media-image" }] });

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

    expect(result).toEqual({
      processed: 1,
      answeredNo: 0,
      answeredYes: 1,
      introSent: 0,
      introPending: 1,
      introFailed: 0,
      deliveryFailed: 0,
      deliveryConfirmed: 0,
      unidentifiedReplies: 0,
      ignored: 0,
    });
    expect(platformApiMock.sendWhatsappMessage).toHaveBeenCalledTimes(2);
    expect(platformApiMock.sendWhatsappMessage).toHaveBeenNthCalledWith(
      1,
      TEST_PHONE_NUMBER_ID,
      expect.objectContaining({
        type: "video",
        video: { link: "https://crm.example.com/media/intro.mp4?signed=true" },
      }),
      { projectId: REMOTE_PHONE_NUMBER_DETAIL.projectId },
    );
    expect(platformApiMock.sendWhatsappMessage).toHaveBeenNthCalledWith(
      2,
      TEST_PHONE_NUMBER_ID,
      expect.objectContaining({
        type: "image",
        image: { link: "https://crm.example.com/media/foto.jpg?signed=true" },
      }),
      { projectId: REMOTE_PHONE_NUMBER_DETAIL.projectId },
    );
    expect(repositoryMock.markLeadFlowIntroMediaPending).toHaveBeenCalledWith({
      executionId: 77,
      pendingPayload: expect.objectContaining({
        stage: "intro_media_pending",
        mediaMessages: [
          expect.objectContaining({ messageId: "wamid.media-video", status: "accepted" }),
          expect.objectContaining({ messageId: "wamid.media-image", status: "accepted" }),
        ],
        interactivePayload: expect.objectContaining({ type: "interactive" }),
      }),
    });
    expect(repositoryMock.markLeadFlowIntroSent).not.toHaveBeenCalled();
  });

  it("omite videos mayores al limite de WhatsApp y envia el mensaje interactivo si no quedan adjuntos validos", async () => {
    const testBed = createSyncServiceTestBed();
    service = testBed.service;
    const repositoryMock = testBed.adminKapsoIntegrationsRepositoryMock;
    const platformApiMock = testBed.kapsoPlatformApiServiceMock;
    repositoryMock.markLeadFlowAnsweredYes.mockResolvedValue(ANSWERED_YES_CONTEXT);
    repositoryMock.listActiveFlowProjectMedia.mockResolvedValue([
      {
        id: 99,
        flowUuid: "94d5c3b8-4b43-4c28-8c76-3d9eaf70ad01",
        idProyectoNetsuite: 38,
        projectName: "Andira",
        stepCode: "intro",
        mediaType: "document",
        originalName: "recorrido.mp4",
        storedFilename: "recorrido.mp4",
        relativePath: "flow/38/intro/recorrido.mp4",
        publicUrl: "https://crm.example.com/api/v1/kapso/media/recorrido.mp4",
        mimeType: "video/mp4",
        fileSize: 77935229,
        sortOrder: 1,
        active: true,
      },
    ]);
    platformApiMock.sendWhatsappMessage.mockResolvedValue({ messages: [{ id: "wamid.intro-text" }] });

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
                    id: "wamid.yes-oversized-video-response",
                    timestamp: "1783009761",
                    type: "button",
                    button: {
                      payload: "Si, enviar informacion",
                      text: "Si, enviar informacion",
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(result).toEqual({
      processed: 1,
      answeredNo: 0,
      answeredYes: 1,
      introSent: 1,
      introPending: 0,
      introFailed: 0,
      deliveryFailed: 0,
      deliveryConfirmed: 0,
      unidentifiedReplies: 0,
      ignored: 0,
    });
    expect(platformApiMock.sendWhatsappMessage).toHaveBeenCalledTimes(1);
    expect(platformApiMock.sendWhatsappMessage).toHaveBeenCalledWith(
      TEST_PHONE_NUMBER_ID,
      expect.objectContaining({
        type: "interactive",
      }),
      { projectId: REMOTE_PHONE_NUMBER_DETAIL.projectId },
    );
    expect(repositoryMock.markLeadFlowIntroMediaPending).not.toHaveBeenCalled();
    expect(repositoryMock.markLeadFlowIntroSent).toHaveBeenCalledWith({
      executionId: 77,
      messageId: "wamid.intro-text",
    });
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

    expect(result).toEqual({
      processed: 1,
      answeredNo: 0,
      answeredYes: 1,
      introSent: 0,
      introPending: 0,
      introFailed: 1,
      deliveryFailed: 0,
      deliveryConfirmed: 0,
      unidentifiedReplies: 0,
      ignored: 0,
    });
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

    expect(result).toEqual({
      processed: 1,
      answeredNo: 1,
      answeredYes: 0,
      introSent: 0,
      introPending: 0,
      introFailed: 0,
      deliveryFailed: 0,
      deliveryConfirmed: 0,
      unidentifiedReplies: 0,
      ignored: 0,
    });
    expect(repositoryMock.markLeadFlowAnsweredNo).toHaveBeenCalledWith({
      phoneNumberId: TEST_PHONE_NUMBER_ID,
      leadPhoneNumber: "50687515938",
      contextMessageId: null,
      responsePayload: expect.objectContaining({
        messageId: "wamid.free-text",
        replyText: "No gracias",
        replySource: "text",
      }),
    });
    expect(repositoryMock.markLeadFlowAnsweredYes).not.toHaveBeenCalled();
    expect(repositoryMock.registerUnidentifiedInitialReply).not.toHaveBeenCalled();
  });

  it("marca el flujo y el lead como perdido cuando el cliente escribe rechazo claro", async () => {
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
                    id: "wamid.free-text-clear-no",
                    timestamp: "1783009759",
                    type: "text",
                    text: {
                      body: "Hola no, no quiero informacion",
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(result).toEqual({
      processed: 1,
      answeredNo: 1,
      answeredYes: 0,
      introSent: 0,
      introPending: 0,
      introFailed: 0,
      deliveryFailed: 0,
      deliveryConfirmed: 0,
      unidentifiedReplies: 0,
      ignored: 0,
    });
    expect(repositoryMock.markLeadFlowAnsweredNo).toHaveBeenCalledWith({
      phoneNumberId: TEST_PHONE_NUMBER_ID,
      leadPhoneNumber: "50687515938",
      contextMessageId: null,
      responsePayload: expect.objectContaining({
        messageId: "wamid.free-text-clear-no",
        replyText: "Hola no, no quiero informacion",
        replySource: "text",
      }),
    });
    expect(repositoryMock.markLeadFlowAnsweredYes).not.toHaveBeenCalled();
    expect(repositoryMock.registerUnidentifiedInitialReply).not.toHaveBeenCalled();
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

    expect(result).toEqual({
      processed: 1,
      answeredNo: 0,
      answeredYes: 1,
      introSent: 1,
      introPending: 0,
      introFailed: 0,
      deliveryFailed: 0,
      deliveryConfirmed: 0,
      unidentifiedReplies: 0,
      ignored: 0,
    });
    expect(repositoryMock.markLeadFlowAnsweredNo).not.toHaveBeenCalled();
    expect(repositoryMock.markLeadFlowAnsweredYes).toHaveBeenCalledWith({
      phoneNumberId: TEST_PHONE_NUMBER_ID,
      leadPhoneNumber: "50687515938",
      contextMessageId: null,
      responsePayload: expect.objectContaining({
        messageId: "wamid.free-text-yes",
        replyText: "Si, enviar informacion",
        replySource: "text",
      }),
    });
    expect(repositoryMock.markLeadFlowIntroSent).toHaveBeenCalledWith({
      executionId: 77,
      messageId: "wamid.intro-text",
    });
  });

  it("registra bitacora cuando el texto libre no permite identificar la intencion", async () => {
    const testBed = createSyncServiceTestBed();
    service = testBed.service;
    const repositoryMock = testBed.adminKapsoIntegrationsRepositoryMock;
    repositoryMock.registerUnidentifiedInitialReply.mockResolvedValue(true);

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

    expect(result).toEqual({
      processed: 1,
      answeredNo: 0,
      answeredYes: 0,
      introSent: 0,
      introPending: 0,
      introFailed: 0,
      deliveryFailed: 0,
      deliveryConfirmed: 0,
      unidentifiedReplies: 1,
      ignored: 0,
    });
    expect(repositoryMock.markLeadFlowAnsweredNo).not.toHaveBeenCalled();
    expect(repositoryMock.markLeadFlowAnsweredYes).not.toHaveBeenCalled();
    expect(repositoryMock.registerUnidentifiedInitialReply).toHaveBeenCalledWith({
      phoneNumberId: TEST_PHONE_NUMBER_ID,
      leadPhoneNumber: "50687515938",
      contextMessageId: null,
      replyText: "No estoy seguro, talvez si despues me manda algo",
      responsePayload: expect.objectContaining({
        messageId: "wamid.free-text-ambiguous",
        replyText: "No estoy seguro, talvez si despues me manda algo",
        replySource: "text",
      }),
    });
  });

  it("envia el mensaje configurado cuando el cliente selecciona una opcion de intro", async () => {
    const testBed = createSyncServiceTestBed();
    service = testBed.service;
    const repositoryMock = testBed.adminKapsoIntegrationsRepositoryMock;
    const platformApiMock = testBed.kapsoPlatformApiServiceMock;
    const optionContext = {
      ...ANSWERED_YES_CONTEXT,
      introOptionsJson: JSON.stringify([
        {
          id: "intro_ver_precios",
          label: "Ver precios",
          messageTemplate:
            "Claro {{nombre_lead}}, te comparto la informacion de precios de {{proyecto_lead}}.",
        },
        {
          id: "intro_agendar_visita",
          label: "Agendar visita",
          messageTemplate: "Perfecto {{nombre_lead}}, coordinemos una visita para que conozcas {{proyecto_lead}}.",
        },
        {
          id: "intro_hablar_asesor",
          label: "Hablar con asesor",
          messageTemplate: "Con gusto {{nombre_lead}}, un asesor continuara la conversacion contigo.",
        },
      ]),
    };
    repositoryMock.findLeadFlowIntroOptionContext.mockResolvedValue(optionContext);
    repositoryMock.markLeadFlowIntroOptionAnswered.mockResolvedValue(optionContext);
    platformApiMock.sendWhatsappMessage.mockResolvedValue({ messages: [{ id: "wamid.option-response" }] });

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
                    id: "wamid.intro-option",
                    timestamp: "1783009764",
                    type: "button",
                    context: {
                      id: "wamid.intro-interactive",
                    },
                    button: {
                      text: "Selected: Ver precios",
                      payload: "intro_ver_precios",
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(result.processed).toBe(1);
    expect(result.unidentifiedReplies).toBe(0);
    expect(result.ignored).toBe(0);
    expect(repositoryMock.findLeadFlowIntroOptionContext).toHaveBeenCalledWith({
      phoneNumberId: TEST_PHONE_NUMBER_ID,
      leadPhoneNumber: "50687515938",
      contextMessageId: "wamid.intro-interactive",
    });
    expect(platformApiMock.sendWhatsappMessage).toHaveBeenCalledWith(
      TEST_PHONE_NUMBER_ID,
      expect.objectContaining({
        to: "50687515938",
        type: "interactive",
        interactive: expect.objectContaining({
          body: {
            text: "Claro Nombre del lead, te comparto la informacion de precios de Andira.",
          },
          action: {
            buttons: [
              {
                type: "reply",
                reply: {
                  id: "intro_agendar_visita",
                  title: "Agendar visita",
                },
              },
              {
                type: "reply",
                reply: {
                  id: "intro_hablar_asesor",
                  title: "Hablar con asesor",
                },
              },
            ],
          },
        }),
      }),
      { projectId: REMOTE_PHONE_NUMBER_DETAIL.projectId },
    );
    expect(repositoryMock.markLeadFlowIntroOptionAnswered).toHaveBeenCalledWith({
      phoneNumberId: TEST_PHONE_NUMBER_ID,
      leadPhoneNumber: "50687515938",
      contextMessageId: "wamid.intro-interactive",
      optionId: "intro_ver_precios",
      optionLabel: "Ver precios",
      keepInteractiveReady: true,
      nextInteractiveMessageId: "wamid.option-response",
      responsePayload: expect.objectContaining({
        messageId: "wamid.intro-option",
        remainingOptions: [
          {
            id: "intro_agendar_visita",
            label: "Agendar visita",
          },
          {
            id: "intro_hablar_asesor",
            label: "Hablar con asesor",
          },
        ],
        optionResponse: expect.objectContaining({
          messages: [{ id: "wamid.option-response" }],
        }),
      }),
    });
    expect(repositoryMock.registerUnidentifiedInitialReply).not.toHaveBeenCalled();
  });

  it("mantiene activas las opciones restantes despues de una seleccion previa de intro", async () => {
    const testBed = createSyncServiceTestBed();
    service = testBed.service;
    const repositoryMock = testBed.adminKapsoIntegrationsRepositoryMock;
    const platformApiMock = testBed.kapsoPlatformApiServiceMock;
    const optionContext = {
      ...ANSWERED_YES_CONTEXT,
      introOptionsJson: JSON.stringify([
        {
          id: "intro_ver_precios",
          label: "Ver precios",
          messageTemplate:
            "Claro {{nombre_lead}}, te comparto la informacion de precios de {{proyecto_lead}}.",
        },
        {
          id: "intro_agendar_visita",
          label: "Agendar visita",
          messageTemplate: "Perfecto {{nombre_lead}}, coordinemos una visita para que conozcas {{proyecto_lead}}.",
        },
        {
          id: "intro_hablar_asesor",
          label: "Hablar con asesor",
          messageTemplate: "Con gusto {{nombre_lead}}, un asesor continuara la conversacion contigo.",
        },
      ]),
    };
    repositoryMock.findLeadFlowIntroOptionContext.mockResolvedValue(optionContext);
    repositoryMock.markLeadFlowIntroOptionAnswered.mockResolvedValue(optionContext);
    platformApiMock.sendWhatsappMessage.mockResolvedValue({ messages: [{ id: "wamid.visit-response" }] });

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
                    id: "wamid.intro-option-visit",
                    timestamp: "1783009765",
                    type: "button",
                    context: {
                      id: "wamid.option-response",
                    },
                    button: {
                      text: "Selected: Agendar visita",
                      payload: "intro_agendar_visita",
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(result.processed).toBe(1);
    expect(platformApiMock.sendWhatsappMessage).toHaveBeenCalledWith(
      TEST_PHONE_NUMBER_ID,
      expect.objectContaining({
        to: "50687515938",
        type: "interactive",
        interactive: expect.objectContaining({
          body: {
            text: "Perfecto Nombre del lead, coordinemos una visita para que conozcas Andira.",
          },
          action: {
            buttons: [
              {
                type: "reply",
                reply: {
                  id: "intro_ver_precios",
                  title: "Ver precios",
                },
              },
              {
                type: "reply",
                reply: {
                  id: "intro_hablar_asesor",
                  title: "Hablar con asesor",
                },
              },
            ],
          },
        }),
      }),
      { projectId: REMOTE_PHONE_NUMBER_DETAIL.projectId },
    );
    expect(repositoryMock.markLeadFlowIntroOptionAnswered).toHaveBeenCalledWith({
      phoneNumberId: TEST_PHONE_NUMBER_ID,
      leadPhoneNumber: "50687515938",
      contextMessageId: "wamid.option-response",
      optionId: "intro_agendar_visita",
      optionLabel: "Agendar visita",
      keepInteractiveReady: true,
      nextInteractiveMessageId: "wamid.visit-response",
      responsePayload: expect.objectContaining({
        messageId: "wamid.intro-option-visit",
        remainingOptions: [
          {
            id: "intro_ver_precios",
            label: "Ver precios",
          },
          {
            id: "intro_hablar_asesor",
            label: "Hablar con asesor",
          },
        ],
      }),
    });
  });

  it("registra como no identificada una opcion de intro que ya no existe en la configuracion", async () => {
    const testBed = createSyncServiceTestBed();
    service = testBed.service;
    const repositoryMock = testBed.adminKapsoIntegrationsRepositoryMock;
    const platformApiMock = testBed.kapsoPlatformApiServiceMock;
    repositoryMock.findLeadFlowIntroOptionContext.mockResolvedValue({
      ...ANSWERED_YES_CONTEXT,
      introOptionsJson: JSON.stringify([
        {
          id: "intro_agendar",
          label: "Agendar visita",
          messageTemplate: "Perfecto {{nombre_lead}}, coordinemos una visita para que conozcas {{proyecto_lead}}.",
        },
      ]),
    });
    repositoryMock.registerUnidentifiedInitialReply.mockResolvedValue(true);

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
                    id: "wamid.removed-intro-option",
                    timestamp: "1783009765",
                    type: "button",
                    context: {
                      id: "wamid.intro-interactive",
                    },
                    button: {
                      text: "Selected: Ver precios",
                      payload: "intro_ver_precios",
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(result).toEqual({
      processed: 1,
      answeredNo: 0,
      answeredYes: 0,
      introSent: 0,
      introPending: 0,
      introFailed: 0,
      deliveryFailed: 0,
      deliveryConfirmed: 0,
      unidentifiedReplies: 1,
      ignored: 0,
    });
    expect(platformApiMock.sendWhatsappMessage).not.toHaveBeenCalled();
    expect(repositoryMock.markLeadFlowIntroOptionAnswered).not.toHaveBeenCalled();
    expect(repositoryMock.registerUnidentifiedInitialReply).toHaveBeenCalledWith({
      phoneNumberId: TEST_PHONE_NUMBER_ID,
      leadPhoneNumber: "50687515938",
      contextMessageId: "wamid.intro-interactive",
      replyText: "Selected: Ver precios",
      responsePayload: expect.objectContaining({
        messageId: "wamid.removed-intro-option",
        replyText: "Selected: Ver precios",
        replySource: "button",
      }),
    });
  });

  it("correlaciona respuestas entrantes con el mensaje inicial respondido", async () => {
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
                    context: {
                      id: "wamid.initial-template",
                    },
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

    expect(result.answeredNo).toBe(1);
    expect(repositoryMock.markLeadFlowAnsweredNo).toHaveBeenCalledWith({
      phoneNumberId: TEST_PHONE_NUMBER_ID,
      leadPhoneNumber: "50687515938",
      contextMessageId: "wamid.initial-template",
      responsePayload: expect.objectContaining({
        messageId: "wamid.no-response",
        contextMessageId: "wamid.initial-template",
        replyText: "No, gracias",
      }),
    });
  });

  it("marca delivery_failed cuando Kapso notifica fallo asincronico del template inicial", async () => {
    const testBed = createSyncServiceTestBed();
    service = testBed.service;
    const repositoryMock = testBed.adminKapsoIntegrationsRepositoryMock;
    repositoryMock.markInitialTemplateDeliveryFailed.mockResolvedValue(true);

    const result = await service.processInboundMessageWebhook({
      phone_number_id: TEST_PHONE_NUMBER_ID,
      message: {
        id: "wamid.failed",
        to: "50687515938",
        type: "template",
        kapso: {
          status: "failed",
          statuses: [
            {
              id: "wamid.failed",
              status: "failed",
              recipient_id: "50687515938",
              errors: [
                {
                  code: 130472,
                  title: "User's number is part of an experiment",
                  message: "User's number is part of an experiment",
                },
              ],
            },
          ],
        },
      },
    });

    expect(result).toEqual({
      processed: 1,
      answeredNo: 0,
      answeredYes: 0,
      introSent: 0,
      introPending: 0,
      introFailed: 0,
      deliveryFailed: 1,
      deliveryConfirmed: 0,
      unidentifiedReplies: 0,
      ignored: 0,
    });
    expect(repositoryMock.markInitialTemplateDeliveryFailed).toHaveBeenCalledWith({
      phoneNumberId: TEST_PHONE_NUMBER_ID,
      leadPhoneNumber: "50687515938",
      messageId: "wamid.failed",
      failureReason: "User's number is part of an experiment",
      responsePayload: expect.objectContaining({
        phone_number_id: TEST_PHONE_NUMBER_ID,
        message: expect.objectContaining({ id: "wamid.failed" }),
      }),
    });
    expect(repositoryMock.markLeadFlowAnsweredNo).not.toHaveBeenCalled();
    expect(repositoryMock.markLeadFlowAnsweredYes).not.toHaveBeenCalled();
  });

  it("marca delivery_failed cuando Meta reenvia statuses.failed", async () => {
    const testBed = createSyncServiceTestBed();
    service = testBed.service;
    const repositoryMock = testBed.adminKapsoIntegrationsRepositoryMock;
    repositoryMock.markInitialTemplateDeliveryFailed.mockResolvedValue(true);

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
                statuses: [
                  {
                    id: "wamid.meta-failed",
                    status: "failed",
                    recipient_id: "50687515938",
                    errors: [
                      {
                        title: "Message failed",
                        error_data: {
                          details: "Failed to send message because this user's phone number is part of an experiment",
                        },
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(result).toEqual({
      processed: 1,
      answeredNo: 0,
      answeredYes: 0,
      introSent: 0,
      introPending: 0,
      introFailed: 0,
      deliveryFailed: 1,
      deliveryConfirmed: 0,
      unidentifiedReplies: 0,
      ignored: 0,
    });
    expect(repositoryMock.markInitialTemplateDeliveryFailed).toHaveBeenCalledWith({
      phoneNumberId: TEST_PHONE_NUMBER_ID,
      leadPhoneNumber: "50687515938",
      messageId: "wamid.meta-failed",
      failureReason: "Failed to send message because this user's phone number is part of an experiment",
      responsePayload: expect.objectContaining({
        id: "wamid.meta-failed",
        status: "failed",
      }),
    });
    expect(repositoryMock.markLeadFlowAnsweredNo).not.toHaveBeenCalled();
    expect(repositoryMock.markLeadFlowAnsweredYes).not.toHaveBeenCalled();
  });

  it("confirma entrega del template inicial cuando Kapso notifica delivered", async () => {
    const testBed = createSyncServiceTestBed();
    service = testBed.service;
    const repositoryMock = testBed.adminKapsoIntegrationsRepositoryMock;
    repositoryMock.markInitialTemplateDeliverySucceeded.mockResolvedValue(true);

    const result = await service.processInboundMessageWebhook({
      phone_number_id: TEST_PHONE_NUMBER_ID,
      message: {
        id: "wamid.delivered",
        to: "50688325933",
        type: "template",
        kapso: {
          status: "delivered",
          statuses: [
            {
              id: "wamid.delivered",
              status: "delivered",
              recipient_id: "50688325933",
            },
          ],
        },
      },
    });

    expect(result).toEqual({
      processed: 1,
      answeredNo: 0,
      answeredYes: 0,
      introSent: 0,
      introPending: 0,
      introFailed: 0,
      deliveryFailed: 0,
      deliveryConfirmed: 1,
      unidentifiedReplies: 0,
      ignored: 0,
    });
    expect(repositoryMock.markInitialTemplateDeliverySucceeded).toHaveBeenCalledWith({
      phoneNumberId: TEST_PHONE_NUMBER_ID,
      leadPhoneNumber: "50688325933",
      messageId: "wamid.delivered",
      deliveryStatus: "delivered",
      responsePayload: expect.objectContaining({
        phone_number_id: TEST_PHONE_NUMBER_ID,
        message: expect.objectContaining({ id: "wamid.delivered" }),
      }),
    });
    expect(repositoryMock.markInitialTemplateDeliveryFailed).not.toHaveBeenCalled();
  });

  it("mantiene pendiente la intro cuando Kapso confirma solo uno de varios adjuntos", async () => {
    const testBed = createSyncServiceTestBed();
    service = testBed.service;
    const repositoryMock = testBed.adminKapsoIntegrationsRepositoryMock;
    const platformApiMock = testBed.kapsoPlatformApiServiceMock;
    repositoryMock.markInitialTemplateDeliverySucceeded.mockResolvedValue(false);
    repositoryMock.markLeadFlowIntroMediaDelivered.mockResolvedValue({ state: "updated_pending" });

    const result = await service.processInboundMessageWebhook({
      phone_number_id: TEST_PHONE_NUMBER_ID,
      message: {
        id: "wamid.intro-media-one",
        to: "50688325933",
        type: "image",
        kapso: {
          status: "delivered",
          statuses: [
            {
              id: "wamid.intro-media-one",
              status: "delivered",
              recipient_id: "50688325933",
            },
          ],
        },
      },
    });

    expect(result).toEqual({
      processed: 1,
      answeredNo: 0,
      answeredYes: 0,
      introSent: 0,
      introPending: 1,
      introFailed: 0,
      deliveryFailed: 0,
      deliveryConfirmed: 0,
      unidentifiedReplies: 0,
      ignored: 0,
    });
    expect(repositoryMock.markLeadFlowIntroMediaDelivered).toHaveBeenCalledWith({
      phoneNumberId: TEST_PHONE_NUMBER_ID,
      leadPhoneNumber: "50688325933",
      messageId: "wamid.intro-media-one",
      deliveryStatus: "delivered",
      responsePayload: expect.objectContaining({
        phone_number_id: TEST_PHONE_NUMBER_ID,
        message: expect.objectContaining({ id: "wamid.intro-media-one" }),
      }),
    });
    expect(platformApiMock.sendWhatsappMessage).not.toHaveBeenCalled();
    expect(repositoryMock.markLeadFlowIntroSent).not.toHaveBeenCalled();
  });

  it("envia el texto interactivo solo cuando todos los adjuntos de intro estan confirmados", async () => {
    const testBed = createSyncServiceTestBed();
    service = testBed.service;
    const repositoryMock = testBed.adminKapsoIntegrationsRepositoryMock;
    const platformApiMock = testBed.kapsoPlatformApiServiceMock;
    repositoryMock.markInitialTemplateDeliverySucceeded.mockResolvedValue(false);
    repositoryMock.markLeadFlowIntroMediaDelivered.mockResolvedValue({
      state: "ready",
      context: {
        executionId: 77,
        phoneNumberId: TEST_PHONE_NUMBER_ID,
        projectExternalId: REMOTE_PHONE_NUMBER_DETAIL.projectId,
        interactivePayload: {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: "50688325933",
          type: "interactive",
          interactive: {
            type: "button",
            body: {
              text: "Perfecto Nombre del lead, te comparto un video introductorio de Andira y algunas fotos.",
            },
            action: {
              buttons: [
                {
                  type: "reply",
                  reply: {
                    id: "intro_ver_precios",
                    title: "Ver precios",
                  },
                },
              ],
            },
          },
        },
      },
    });
    platformApiMock.sendWhatsappMessage.mockResolvedValue({
      messages: [{ id: "wamid.intro-interactive" }],
    });

    const result = await service.processInboundMessageWebhook({
      phone_number_id: TEST_PHONE_NUMBER_ID,
      message: {
        id: "wamid.intro-media-last",
        to: "50688325933",
        type: "image",
        kapso: {
          status: "read",
          statuses: [
            {
              id: "wamid.intro-media-last",
              status: "read",
              recipient_id: "50688325933",
            },
          ],
        },
      },
    });

    expect(result).toEqual({
      processed: 1,
      answeredNo: 0,
      answeredYes: 0,
      introSent: 1,
      introPending: 0,
      introFailed: 0,
      deliveryFailed: 0,
      deliveryConfirmed: 0,
      unidentifiedReplies: 0,
      ignored: 0,
    });
    expect(platformApiMock.sendWhatsappMessage).toHaveBeenCalledTimes(1);
    expect(platformApiMock.sendWhatsappMessage).toHaveBeenCalledWith(
      TEST_PHONE_NUMBER_ID,
      expect.objectContaining({
        to: "50688325933",
        type: "interactive",
        interactive: expect.objectContaining({
          type: "button",
          body: expect.objectContaining({
            text: expect.stringContaining("Perfecto Nombre del lead"),
          }),
        }),
      }),
      { projectId: REMOTE_PHONE_NUMBER_DETAIL.projectId },
    );
    expect(repositoryMock.markLeadFlowIntroSent).toHaveBeenCalledWith({
      executionId: 77,
      messageId: "wamid.intro-interactive",
    });
  });

  it("envia el texto interactivo cuando un adjunto falla pero el paquete de intro queda en estado terminal", async () => {
    const testBed = createSyncServiceTestBed();
    service = testBed.service;
    const repositoryMock = testBed.adminKapsoIntegrationsRepositoryMock;
    const platformApiMock = testBed.kapsoPlatformApiServiceMock;
    repositoryMock.markInitialTemplateDeliveryFailed.mockResolvedValue(false);
    repositoryMock.markLeadFlowIntroMediaFailed.mockResolvedValue({
      state: "ready",
      context: {
        executionId: 88,
        phoneNumberId: TEST_PHONE_NUMBER_ID,
        projectExternalId: REMOTE_PHONE_NUMBER_DETAIL.projectId,
        interactivePayload: {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: "50688325933",
          type: "interactive",
          interactive: {
            type: "button",
            body: {
              text: "Perfecto Nombre del lead, te comparto un video introductorio de Andira y algunas fotos.",
            },
            action: {
              buttons: [
                {
                  type: "reply",
                  reply: {
                    id: "intro_hablar_asesor",
                    title: "Hablar con asesor",
                  },
                },
              ],
            },
          },
        },
      },
    });
    platformApiMock.sendWhatsappMessage.mockResolvedValue({
      messages: [{ id: "wamid.intro-interactive-after-partial-failure" }],
    });

    const result = await service.processInboundMessageWebhook({
      phone_number_id: TEST_PHONE_NUMBER_ID,
      message: {
        id: "wamid.intro-media-failed",
        to: "50688325933",
        type: "image",
        kapso: {
          status: "failed",
          statuses: [
            {
              id: "wamid.intro-media-failed",
              status: "failed",
              recipient_id: "50688325933",
              errors: [
                {
                  title: "Media failed",
                  message: "One media item failed",
                },
              ],
            },
          ],
        },
      },
    });

    expect(result).toEqual({
      processed: 1,
      answeredNo: 0,
      answeredYes: 0,
      introSent: 1,
      introPending: 0,
      introFailed: 0,
      deliveryFailed: 0,
      deliveryConfirmed: 0,
      unidentifiedReplies: 0,
      ignored: 0,
    });
    expect(platformApiMock.sendWhatsappMessage).toHaveBeenCalledWith(
      TEST_PHONE_NUMBER_ID,
      expect.objectContaining({
        to: "50688325933",
        type: "interactive",
      }),
      { projectId: REMOTE_PHONE_NUMBER_DETAIL.projectId },
    );
    expect(repositoryMock.markLeadFlowIntroSent).toHaveBeenCalledWith({
      executionId: 88,
      messageId: "wamid.intro-interactive-after-partial-failure",
    });
  });

  it("confirma entrega del template inicial cuando Meta reenvia statuses.read", async () => {
    const testBed = createSyncServiceTestBed();
    service = testBed.service;
    const repositoryMock = testBed.adminKapsoIntegrationsRepositoryMock;
    repositoryMock.markInitialTemplateDeliverySucceeded.mockResolvedValue(true);

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
                statuses: [
                  {
                    id: "wamid.meta-read",
                    status: "read",
                    recipient_id: "50688325933",
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(result).toEqual({
      processed: 1,
      answeredNo: 0,
      answeredYes: 0,
      introSent: 0,
      introPending: 0,
      introFailed: 0,
      deliveryFailed: 0,
      deliveryConfirmed: 1,
      unidentifiedReplies: 0,
      ignored: 0,
    });
    expect(repositoryMock.markInitialTemplateDeliverySucceeded).toHaveBeenCalledWith({
      phoneNumberId: TEST_PHONE_NUMBER_ID,
      leadPhoneNumber: "50688325933",
      messageId: "wamid.meta-read",
      deliveryStatus: "read",
      responsePayload: expect.objectContaining({
        id: "wamid.meta-read",
        status: "read",
      }),
    });
    expect(repositoryMock.markInitialTemplateDeliveryFailed).not.toHaveBeenCalled();
  });

  it("no marca exito de entrega cuando Kapso solo notifica sent", async () => {
    const testBed = createSyncServiceTestBed();
    service = testBed.service;
    const repositoryMock = testBed.adminKapsoIntegrationsRepositoryMock;

    const result = await service.processInboundMessageWebhook({
      phone_number_id: TEST_PHONE_NUMBER_ID,
      message: {
        id: "wamid.sent",
        to: "50688325933",
        type: "template",
        kapso: {
          status: "sent",
          statuses: [
            {
              id: "wamid.sent",
              status: "sent",
              recipient_id: "50688325933",
            },
          ],
        },
      },
    });

    expect(result).toEqual({
      processed: 0,
      answeredNo: 0,
      answeredYes: 0,
      introSent: 0,
      introPending: 0,
      introFailed: 0,
      deliveryFailed: 0,
      deliveryConfirmed: 0,
      unidentifiedReplies: 0,
      ignored: 0,
    });
    expect(repositoryMock.markInitialTemplateDeliverySucceeded).not.toHaveBeenCalled();
    expect(repositoryMock.markInitialTemplateDeliveryFailed).not.toHaveBeenCalled();
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
    expect(html).toContain("la sincronizacion fallo: Kapso API error: {&quot;error&quot;:&quot;Forbidden&quot;}");
    expect(kapsoRepositoryMock.recordSetupRedirect).toHaveBeenLastCalledWith(
      expect.objectContaining({
        phoneNumberId: TEST_PHONE_NUMBER_ID,
        syncStatus: "sync_failed",
      }),
    );
  });
});
