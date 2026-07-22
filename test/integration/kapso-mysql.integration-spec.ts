import { getQueueToken } from "@nestjs/bullmq";
import { INestApplication, UnauthorizedException, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { createHmac, generateKeyPairSync, KeyObject } from "crypto";
import { createServer, Server } from "http";
import { sign } from "jsonwebtoken";
import { AddressInfo } from "net";
import * as request from "supertest";
import { DataSource } from "typeorm";

import { EntraAuthService } from "../../src/common/auth/entra-auth.service";
import { AdminKapsoIntegrationEntity } from "../../src/modules/kapso/entities/admin-kapso-integration.entity";
import { KapsoPhoneNumberEntity } from "../../src/modules/kapso/entities/kapso-phone-number.entity";
import { KAPSO_JOBS_QUEUE } from "../../src/modules/kapso/common/kapso-jobs.constants";
import { AdminKapsoIntegrationsRepository } from "../../src/modules/kapso/repositories/admin-kapso-integrations.repository";
import { KapsoFlowProjectMediaRepository } from "../../src/modules/kapso/repositories/kapso-flow-project-media.repository";
import { KapsoLeadAutomationRepository } from "../../src/modules/kapso/repositories/kapso-lead-automation.repository";
import { KapsoRepository } from "../../src/modules/kapso/repositories/kapso.repository";
import { KapsoJobsProcessor } from "../../src/modules/kapso/services/kapso-jobs.processor";
import { KapsoJobsSchedulerService } from "../../src/modules/kapso/services/kapso-jobs-scheduler.service";
import { KapsoSyncService } from "../../src/modules/kapso/services/kapso-sync.service";
import { createCrmFixtureTables, createMysqlTestDatabase, MysqlTestDatabase } from "./mysql-test-database";

const FLOW_UUID = "94d5c3b8-4b43-4c28-8c76-3d9eaf70ad01";

describe("Kapso MySQL integration", () => {
  let database: MysqlTestDatabase;
  let dataSource: DataSource;
  let repository: KapsoRepository;
  let adminRepository: AdminKapsoIntegrationsRepository;
  let flowRepository: KapsoFlowProjectMediaRepository;
  let leadRepository: KapsoLeadAutomationRepository;
  let app: INestApplication;
  let jwksFixture: JwksFixture;
  const syncServiceMock = {
    handlePhoneNumberCreatedEvent: jest.fn(),
    handlePhoneNumberDeletedEvent: jest.fn(),
    processInboundMessageWebhook: jest.fn(),
  };

  beforeAll(async () => {
    database = await createMysqlTestDatabase();
    dataSource = database.dataSource;
    await dataSource.runMigrations();
    await createCrmFixtureTables(dataSource);
    jwksFixture = await createJwksFixture();
    repository = new KapsoRepository(dataSource.getRepository(KapsoPhoneNumberEntity));
    adminRepository = new AdminKapsoIntegrationsRepository(dataSource, dataSource.getRepository(AdminKapsoIntegrationEntity));
    flowRepository = new KapsoFlowProjectMediaRepository(dataSource);
    leadRepository = new KapsoLeadAutomationRepository(dataSource);
    app = await createRealApp(database.databaseName, syncServiceMock);
  }, 300_000);

  afterEach(async () => {
    if (!dataSource?.isInitialized) {
      return;
    }

    await dataSource.query("DELETE FROM kapso_webhook_receipts");
    await dataSource.query("DELETE FROM bitacoras");
    await dataSource.query("DELETE FROM admin_kapso_integrations");
    await dataSource.query("DELETE FROM kapso_lead_flow_executions");
    await dataSource.query("DELETE FROM kapso_flow_project_media");
    await dataSource.query("DELETE FROM kapso_business_flow_projects");
    await dataSource.query("DELETE FROM kapso_phone_numbers");
    await dataSource.query("DELETE FROM leads");
    await dataSource.query("DELETE FROM admins");
    await dataSource.query("DELETE FROM proyectos");
    await dataSource.query("UPDATE kapso_business_flows SET enabled = 1");
  });

  afterAll(async () => {
    await app?.close();
    await closeServer(jwksFixture?.server);
    await database?.destroy();
  }, 60_000);

  it("reconstruye el esquema completo y sus datos semilla desde una base vacía", async () => {
    const migrations = (await dataSource.query("SELECT name FROM typeorm_migrations ORDER BY timestamp")) as Array<{ name: string }>;
    const tables = (await dataSource.query("SHOW TABLES")) as Array<Record<string, string>>;
    const tableNames = tables.map((row) => Object.values(row)[0]);
    const flows = (await dataSource.query("SELECT flow_code, enabled FROM kapso_business_flows")) as Array<{
      enabled: number;
      flow_code: string;
    }>;

    expect(migrations).toHaveLength(7);
    expect(tableNames).toEqual(
      expect.arrayContaining([
        "admin_kapso_integrations",
        "kapso_business_flows",
        "kapso_flow_project_media",
        "kapso_lead_flow_executions",
        "kapso_phone_numbers",
        "kapso_template_catalog",
        "kapso_webhook_receipts",
      ]),
    );
    expect(flows).toContainEqual({
      flow_code: "lead_initial_contact",
      enabled: 1,
    });
  });

  it("revierte y reaplica la migración de recibos sin afectar las demás tablas", async () => {
    await dataSource.undoLastMigration();
    const queryRunner = dataSource.createQueryRunner();

    try {
      expect(await queryRunner.hasTable("kapso_webhook_receipts")).toBe(false);
      expect(await queryRunner.hasTable("kapso_phone_numbers")).toBe(true);

      const reapplied = await dataSource.runMigrations();

      expect(reapplied).toHaveLength(1);
      expect(await queryRunner.hasTable("kapso_webhook_receipts")).toBe(true);
    } finally {
      await queryRunner.release();
    }
  });

  it("permite una sola reserva cuando dos instancias reciben el mismo evento", async () => {
    const reservations = await Promise.all([
      repository.reserveWebhookReceipt("meta", "same-event", "phone-1", "a".repeat(64)),
      repository.reserveWebhookReceipt("meta", "same-event", "phone-1", "a".repeat(64)),
    ]);

    expect(reservations.filter((item) => item.acquired)).toHaveLength(1);
    expect(reservations.filter((item) => !item.acquired)).toHaveLength(1);

    const rows = (await dataSource.query("SELECT attempt_count FROM kapso_webhook_receipts WHERE scope = ? AND idempotency_key = ?", [
      "meta",
      "same-event",
    ])) as Array<{ attempt_count: number }>;

    expect(rows).toEqual([{ attempt_count: 1 }]);
  });

  it("rechaza la misma llave con un payload diferente", async () => {
    await repository.reserveWebhookReceipt("kapso", "reused-key", "phone-2", "b".repeat(64));

    const reservation = await repository.reserveWebhookReceipt("kapso", "reused-key", "phone-2", "c".repeat(64));

    expect(reservation).toMatchObject({
      acquired: false,
      payloadMismatch: true,
      status: "processing",
    });
  });

  it("recupera recibos fallidos o con lease vencido y aumenta attempt_count", async () => {
    await repository.reserveWebhookReceipt("platform", "retry-failed", null, "d".repeat(64));
    await repository.completeWebhookReceipt("platform", "retry-failed", "failed", "temporary");

    const failedRetry = await repository.reserveWebhookReceipt("platform", "retry-failed", null, "d".repeat(64));

    await repository.reserveWebhookReceipt("platform", "retry-expired", null, "e".repeat(64));
    await dataSource.query(
      "UPDATE kapso_webhook_receipts SET locked_until = DATE_SUB(NOW(), INTERVAL 1 SECOND) WHERE idempotency_key = ?",
      ["retry-expired"],
    );

    const expiredRetry = await repository.reserveWebhookReceipt("platform", "retry-expired", null, "e".repeat(64));
    const rows = (await dataSource.query(
      "SELECT idempotency_key, attempt_count FROM kapso_webhook_receipts ORDER BY idempotency_key",
    )) as Array<{ attempt_count: number; idempotency_key: string }>;

    expect(failedRetry.acquired).toBe(true);
    expect(expiredRetry.acquired).toBe(true);
    expect(rows).toEqual([
      { idempotency_key: "retry-expired", attempt_count: 2 },
      { idempotency_key: "retry-failed", attempt_count: 2 },
    ]);
  });

  it("mantiene el recibo procesado como terminal y limita el error persistido", async () => {
    await repository.reserveWebhookReceipt("meta", "processed-event", "phone-3", "f".repeat(64));
    await repository.completeWebhookReceipt("meta", "processed-event", "processed", "x".repeat(700));

    const duplicate = await repository.reserveWebhookReceipt("meta", "processed-event", "phone-3", "f".repeat(64));
    const rows = (await dataSource.query(
      "SELECT status, CHAR_LENGTH(processing_error) AS errorLength, processed_at AS processedAt FROM kapso_webhook_receipts",
    )) as Array<{
      errorLength: number;
      processedAt: Date | null;
      status: string;
    }>;

    expect(duplicate).toMatchObject({
      acquired: false,
      payloadMismatch: false,
      status: "processed",
    });
    expect(rows[0]).toMatchObject({
      status: "processed",
    });
    expect(Number(rows[0].errorLength)).toBe(500);
    expect(rows[0].processedAt).toBeInstanceOf(Date);
  });

  it("hace upsert de números, toca webhooks y registra sync/setup en kapso_phone_numbers", async () => {
    const created = await repository.upsertPhoneNumber({
      phoneNumberId: "phone-upsert-1",
      phoneNumberName: "Línea A",
      displayPhoneNumber: "+50670001111",
      verifiedName: "Verificado",
      businessAccountId: "ba-1",
      status: "CONNECTED",
      qualityRating: "GREEN",
      throughputTier: "STANDARD",
      connectionType: "cloud_api",
      rawPayload: { source: "integration" },
      projectExternalId: "project-1",
      projectName: "Proyecto 1",
      projectPayload: { id: "project-1" },
      kapsoCustomerId: "customer-1",
      customerName: "Cliente 1",
      customerExternalId: "ext-1",
      customerPayload: { id: "customer-1" },
      setupStatus: "success",
      setupSyncStatus: "processed",
    });

    const updated = await repository.upsertPhoneNumber({
      phoneNumberId: "phone-upsert-1",
      phoneNumberName: "Línea A actualizada",
      displayPhoneNumber: "+50670001111",
      verifiedName: null,
      businessAccountId: "ba-1",
      status: "CONNECTED",
      qualityRating: null,
      throughputTier: null,
      connectionType: null,
      rawPayload: { source: "integration-update" },
      projectExternalId: null,
      projectName: null,
      kapsoCustomerId: null,
      customerName: null,
      customerExternalId: null,
      setupSyncStatus: "pending_remote_sync",
    });

    await repository.touchPhoneNumberWebhookEvent({
      scope: "meta",
      eventName: "messages",
      phoneNumberId: "phone-upsert-1",
      idempotencyKey: "touch-1",
      signatureValid: true,
      processingStatus: "processed",
      payloadJson: { ok: true },
    });

    const duplicate = await repository.findProcessedWebhookDuplicate("meta", "phone-upsert-1", "touch-1");
    await repository.recordWebhookSyncResult("phone-upsert-1", "processed", null, [{ id: "wh-1" }]);
    await repository.recordSetupRedirect({
      status: "success",
      setupLinkId: "setup-1",
      phoneNumberId: "phone-upsert-1",
      businessAccountId: "ba-1",
      whatsappConfigId: "wa-1",
      provisionedPhoneNumberId: "phone-upsert-1",
      displayPhoneNumber: "+50670001111",
      errorCode: null,
      syncStatus: "processed",
      queryJson: { setup: true },
    });

    const listed = await repository.listPhoneNumbers();
    const pending = await repository.listPendingRemoteSyncPhoneNumbers(10);

    expect(created.id).toBe(updated.id);
    expect(updated.phoneNumberName).toBe("Línea A actualizada");
    expect(updated.projectExternalId).toBe("project-1");
    expect(duplicate?.phoneNumberId).toBe("phone-upsert-1");
    expect(listed.some((item) => item.phoneNumberId === "phone-upsert-1")).toBe(true);
    expect(pending.every((item) => item.phoneNumberId !== "phone-upsert-1")).toBe(true);
  });

  it("aplica unicidad y cascada de las relaciones críticas", async () => {
    await dataSource.query("INSERT INTO kapso_phone_numbers (phone_number_id) VALUES (?)", ["phone-constraint"]);
    const phones = (await dataSource.query("SELECT id FROM kapso_phone_numbers WHERE phone_number_id = ?", ["phone-constraint"])) as Array<{
      id: number;
    }>;

    await expect(
      dataSource.query("INSERT INTO kapso_phone_numbers (phone_number_id) VALUES (?)", ["phone-constraint"]),
    ).rejects.toMatchObject({ code: "ER_DUP_ENTRY" });

    await dataSource.query("INSERT INTO admin_kapso_integrations (idnetsuite_admin, id_kapso_phone_number) VALUES (?, ?)", [
      1001,
      phones[0].id,
    ]);
    await dataSource.query("DELETE FROM kapso_phone_numbers WHERE id = ?", [phones[0].id]);

    const relations = (await dataSource.query("SELECT COUNT(*) AS total FROM admin_kapso_integrations")) as Array<{
      total: string | number;
    }>;

    expect(Number(relations[0].total)).toBe(0);
  });

  it("ejecuta el ciclo real de relaciones administrador-Kapso", async () => {
    await dataSource.query(
      `INSERT INTO admins
        (idnetsuite_admin, id_rol_admin, email_admin, name_admin, status_admin)
       VALUES (?, 1, ?, ?, 1)`,
      [610, "admin-610@example.test", "Admin Integración"],
    );
    await dataSource.query(
      `INSERT INTO kapso_phone_numbers
        (phone_number_id, display_phone_number, phone_number_name, active)
       VALUES (?, ?, ?, 1)`,
      ["kapso-admin-phone", "+506 7000 0610", "Línea integración"],
    );
    const phone = await adminRepository.findKapsoPhoneNumberOptionById(
      Number(
        (
          (await dataSource.query("SELECT id FROM kapso_phone_numbers WHERE phone_number_id = ?", ["kapso-admin-phone"])) as Array<{
            id: number;
          }>
        )[0].id,
      ),
    );
    const relation = await adminRepository.createRelation({
      idnetsuiteAdmin: 610,
      kapsoPhoneNumberId: phone!.id,
      status: 1,
    });

    expect(
      await adminRepository.listAdminOptions({
        search: "Integración",
        includeInactive: false,
      }),
    ).toEqual([
      expect.objectContaining({
        idnetsuiteAdmin: 610,
        name: "Admin Integración",
      }),
    ]);
    expect(await adminRepository.findDuplicateRelation(610, phone!.id)).toMatchObject({ id: relation.id });
    expect(
      await adminRepository.listRelations({
        page: 1,
        pageSize: 10,
        search: "integración",
      }),
    ).toMatchObject({
      items: [
        expect.objectContaining({
          id: relation.id,
          idnetsuiteAdmin: 610,
          phoneNumberId: "kapso-admin-phone",
        }),
      ],
      meta: { total: 1, page: 1, pageSize: 10, totalPages: 1 },
    });
    expect(await adminRepository.listActiveIntegrationsByAdmin(610)).toHaveLength(1);

    await adminRepository.updateRelationStatus(relation, 0);

    expect(await adminRepository.listActiveIntegrationsByAdmin(610)).toEqual([]);
  });

  it("arranca AppModule real y valida liveness/readiness con MySQL", async () => {
    await request(app.getHttpServer()).get("/api/v1/health/live").expect(200).expect({ status: "ok" });

    const readiness = await request(app.getHttpServer()).get("/api/v1/health/ready").expect(200);

    expect(readiness.body).toMatchObject({
      status: "ok",
      info: {
        mysql: { status: "up" },
        redis: { status: "up" },
      },
    });
  });

  it("aplica autenticación y rol globales dentro de AppModule", async () => {
    await request(app.getHttpServer()).get("/api/v1/kapso/business-flows").expect(401);
    await request(app.getHttpServer()).get("/api/v1/kapso/business-flows").set("Authorization", "Bearer viewer-token").expect(403);

    const response = await request(app.getHttpServer())
      .get("/api/v1/kapso/business-flows")
      .set("Authorization", "Bearer admin-token")
      .expect(200);

    expect(response.body).toEqual(expect.arrayContaining([expect.objectContaining({ flowUuid: FLOW_UUID })]));
  });

  it("valida un JWT RS256 contra JWKS real y consulta el usuario activo en MySQL", async () => {
    const tenantId = "00000000-0000-4000-8000-000000000011";
    const audience = "00000000-0000-4000-8000-000000000012";
    const clientId = "00000000-0000-4000-8000-000000000013";
    const issuer = `https://login.microsoftonline.com/${tenantId}/v2.0`;
    const configValues: Record<string, unknown> = {
      "security.entraTenantId": tenantId,
      "security.entraAudience": audience,
      "security.entraIssuer": issuer,
      "security.entraRequiredScope": "Kapso.Access",
      "security.entraAllowedClientIds": [clientId],
      "security.entraJwksUri": jwksFixture.url,
    };
    const configService = {
      getOrThrow: jest.fn((key: string) => {
        if (!(key in configValues)) {
          throw new Error(`Missing integration config: ${key}`);
        }
        return configValues[key];
      }),
      get: jest.fn((key: string, fallback: unknown) => configValues[key] ?? fallback),
    } as unknown as ConfigService;
    const service = new EntraAuthService(configService, dataSource);

    await dataSource.query(
      `INSERT INTO admins
        (idnetsuite_admin, id_rol_admin, email_admin, name_admin, status_admin)
       VALUES (?, ?, ?, ?, 1)`,
      [901, 1, "entra-user@example.test", "Entra User"],
    );

    const validToken = sign(
      {
        tid: tenantId,
        azp: clientId,
        scp: "openid Kapso.Access",
        preferred_username: "entra-user@example.test",
        oid: "entra-object-1",
      },
      jwksFixture.privateKey,
      {
        algorithm: "RS256",
        audience,
        issuer,
        expiresIn: "5m",
        keyid: jwksFixture.keyId,
      },
    );
    const invalidScopeToken = sign(
      {
        tid: tenantId,
        azp: clientId,
        scp: "openid",
        preferred_username: "entra-user@example.test",
      },
      jwksFixture.privateKey,
      {
        algorithm: "RS256",
        audience,
        issuer,
        expiresIn: "5m",
        keyid: jwksFixture.keyId,
      },
    );

    await expect(service.authenticate(validToken)).resolves.toMatchObject({
      idNetSuiteAdmin: 901,
      roleId: 1,
      email: "entra-user@example.test",
      name: "Entra User",
      entraObjectId: "entra-object-1",
    });
    await expect(service.authenticate(invalidScopeToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("valida HMAC e idempotencia durable desde el endpoint HTTP real", async () => {
    const rawPayload = JSON.stringify({
      object: "whatsapp_business_account",
      metadata: { phone_number_id: "meta-http-phone" },
    });
    const signature = createHmac("sha256", "integration_whatsapp_secret").update(rawPayload).digest("hex");

    await request(app.getHttpServer())
      .post("/api/v1/webhooks/kapso/meta")
      .set("Content-Type", "application/json")
      .set("x-webhook-signature", "invalid")
      .set("x-idempotency-key", "http-event-invalid")
      .send(rawPayload)
      .expect(401);

    await request(app.getHttpServer())
      .post("/api/v1/webhooks/kapso/meta")
      .set("Content-Type", "application/json")
      .set("x-webhook-signature", signature)
      .set("x-idempotency-key", "http-event-1")
      .send(rawPayload)
      .expect(200)
      .expect({ ok: true });

    const duplicate = await request(app.getHttpServer())
      .post("/api/v1/webhooks/kapso/meta")
      .set("Content-Type", "application/json")
      .set("x-webhook-signature", signature)
      .set("x-idempotency-key", "http-event-1")
      .send(rawPayload)
      .expect(200);
    const rows = (await dataSource.query("SELECT status, attempt_count AS attempts FROM kapso_webhook_receipts WHERE idempotency_key = ?", [
      "http-event-1",
    ])) as Array<{ attempts: number; status: string }>;

    expect(duplicate.body).toMatchObject({
      ok: true,
      duplicate: true,
      phoneNumberId: "meta-http-phone",
      status: "processed",
    });
    expect(rows).toEqual([{ status: "processed", attempts: 1 }]);
    expect(syncServiceMock.processInboundMessageWebhook).toHaveBeenCalledTimes(1);
  });

  it("persiste proyectos, estados de flujo y media usando SQL real", async () => {
    await dataSource.query("INSERT INTO proyectos (id_ProNetsuite, Nombre_proyecto, estado_proyecto) VALUES (?, ?, ?)", [
      7001,
      "Proyecto integración",
      1,
    ]);

    const enabledProject = await flowRepository.enableBusinessFlowProject(FLOW_UUID, 7001);
    const status = await flowRepository.updateBusinessFlowStatus(FLOW_UUID, 0);
    const media = await flowRepository.createFlowProjectMedia({
      flowUuid: FLOW_UUID,
      idProyectoNetsuite: 7001,
      stepCode: "intro",
      mediaType: "document",
      originalName: "brochure.pdf",
      storedFilename: "integration-brochure.pdf",
      relativePath: "flow/project/integration-brochure.pdf",
      publicUrl: "https://media.example/integration-brochure.pdf",
      mimeType: "application/pdf",
      fileSize: 2048,
      sortOrder: 1,
    });

    expect(enabledProject).toMatchObject({
      idProyectoNetsuite: 7001,
      enabled: 1,
    });
    expect(status).toEqual({ ok: true, flowUuid: FLOW_UUID, enabled: 0 });
    expect(await flowRepository.listActiveFlowProjectMedia(FLOW_UUID, 7001, "intro")).toHaveLength(1);

    await flowRepository.deactivateFlowProjectMedia(media!.id);

    expect(await flowRepository.findFlowProjectMediaByStoredFilename("integration-brochure.pdf")).toBeNull();
  });

  it("selecciona candidatos configurados y reserva una sola ejecución concurrente", async () => {
    const fixture = await createLeadCandidateFixture(dataSource, {
      internalLeadId: 8001,
      leadPhone: "50670000001",
    });

    const candidates = await leadRepository.listLeadTemplateCandidates(10, FLOW_UUID);
    const reservations = await Promise.all([
      leadRepository.reserveInitialTemplateSend({
        flowUuid: FLOW_UUID,
        leadId: fixture.leadId,
        internalLeadId: fixture.internalLeadId,
        idnetsuiteAdmin: fixture.idnetsuiteAdmin,
        idProyectoNetsuite: fixture.idProyectoNetsuite,
        phoneNumberId: fixture.phoneNumberId,
        leadPhoneNumber: fixture.leadPhone,
      }),
      leadRepository.reserveInitialTemplateSend({
        flowUuid: FLOW_UUID,
        leadId: fixture.leadId,
        internalLeadId: fixture.internalLeadId,
        idnetsuiteAdmin: fixture.idnetsuiteAdmin,
        idProyectoNetsuite: fixture.idProyectoNetsuite,
        phoneNumberId: fixture.phoneNumberId,
        leadPhoneNumber: fixture.leadPhone,
      }),
    ]);
    const executionRows = (await dataSource.query(
      "SELECT execution_status AS status FROM kapso_lead_flow_executions WHERE idinterno_lead = ?",
      [fixture.internalLeadId],
    )) as Array<{ status: string }>;

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      internalLeadId: fixture.internalLeadId,
      phoneNumberId: fixture.phoneNumberId,
      templateStatus: "approved",
    });
    expect(reservations.filter(Boolean)).toHaveLength(1);
    expect(executionRows).toEqual([{ status: "reserved" }]);
  });

  it("revierte la actualización del lead cuando falla la inserción de ejecución", async () => {
    const fixture = await createLeadCandidateFixture(dataSource, {
      internalLeadId: 8002,
      leadPhone: "50670000002",
    });

    await dataSource.query(`
      CREATE TRIGGER test_fail_execution_insert
      BEFORE INSERT ON kapso_lead_flow_executions
      FOR EACH ROW
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'forced integration rollback'
    `);

    try {
      await expect(
        leadRepository.reserveInitialTemplateSend({
          flowUuid: FLOW_UUID,
          leadId: fixture.leadId,
          internalLeadId: fixture.internalLeadId,
          idnetsuiteAdmin: fixture.idnetsuiteAdmin,
          idProyectoNetsuite: fixture.idProyectoNetsuite,
          phoneNumberId: fixture.phoneNumberId,
          leadPhoneNumber: fixture.leadPhone,
        }),
      ).rejects.toMatchObject({ code: "ER_SIGNAL_EXCEPTION" });
    } finally {
      await dataSource.query("DROP TRIGGER IF EXISTS test_fail_execution_insert");
    }

    const leads = (await dataSource.query("SELECT whatsapp_template_contact_sent AS sent FROM leads WHERE id_lead = ?", [
      fixture.leadId,
    ])) as Array<{ sent: number }>;
    const executions = (await dataSource.query("SELECT COUNT(*) AS total FROM kapso_lead_flow_executions WHERE idinterno_lead = ?", [
      fixture.internalLeadId,
    ])) as Array<{ total: number | string }>;

    expect(leads[0].sent).toBe(2);
    expect(Number(executions[0].total)).toBe(0);
  });

  it("confirma de forma transaccional las respuestas Sí y No del cliente", async () => {
    const yesFixture = await createLeadCandidateFixture(dataSource, {
      internalLeadId: 8003,
      leadPhone: "50670000003",
    });
    const noFixture = await createLeadCandidateFixture(dataSource, {
      internalLeadId: 8004,
      leadPhone: "50670000004",
      idnetsuiteAdmin: 502,
      idProyectoNetsuite: 7002,
      phoneNumberId: "kapso-phone-502",
    });

    const yesReservation = await reserveAndMarkSent(leadRepository, yesFixture);
    const noReservation = await reserveAndMarkSent(leadRepository, noFixture);

    const yesContext = await leadRepository.markLeadFlowAnsweredYes({
      phoneNumberId: yesFixture.phoneNumberId,
      leadPhoneNumber: yesFixture.leadPhone,
      responsePayload: { button: "Si, enviar informacion" },
    });
    const answeredNo = await leadRepository.markLeadFlowAnsweredNo({
      phoneNumberId: noFixture.phoneNumberId,
      leadPhoneNumber: noFixture.leadPhone,
      responsePayload: { button: "No, gracias" },
    });
    const executions = (await dataSource.query(
      "SELECT id_kapso_lead_flow_execution AS id, execution_status AS status FROM kapso_lead_flow_executions ORDER BY id",
    )) as Array<{ id: number; status: string }>;
    const leads = (await dataSource.query(
      "SELECT idinterno_lead AS id, segimineto_lead AS followup, estado_lead AS active, id_Caida AS lossId FROM leads ORDER BY idinterno_lead",
    )) as Array<{
      active: number;
      followup: string;
      id: number;
      lossId: number | null;
    }>;
    const logs = (await dataSource.query(
      "SELECT id_lead_bit AS leadId, id_caida_bit AS reasonId FROM bitacoras ORDER BY id_lead_bit",
    )) as Array<{ leadId: number; reasonId: number }>;

    expect(yesContext).toMatchObject({
      executionId: yesReservation.executionId,
      internalLeadId: yesFixture.internalLeadId,
    });
    expect(answeredNo).toBe(true);
    expect(executions).toEqual([
      { id: yesReservation.executionId, status: "answered_yes" },
      { id: noReservation.executionId, status: "answered_no" },
    ]);
    expect(leads).toEqual([
      {
        id: yesFixture.internalLeadId,
        followup: "08-LEAD-SEGUIMIENTO",
        active: 1,
        lossId: null,
      },
      {
        id: noFixture.internalLeadId,
        followup: "07-LEAD-PERDIDO",
        active: 0,
        lossId: 67,
      },
    ]);
    expect(logs).toEqual([
      { leadId: yesFixture.internalLeadId, reasonId: 69 },
      { leadId: noFixture.internalLeadId, reasonId: 67 },
    ]);
  });
});

type LeadFixture = {
  idProyectoNetsuite: number;
  idnetsuiteAdmin: number;
  internalLeadId: number;
  leadId: number;
  leadPhone: string;
  phoneNumberId: string;
};

async function createLeadCandidateFixture(
  dataSource: DataSource,
  values: {
    idProyectoNetsuite?: number;
    idnetsuiteAdmin?: number;
    internalLeadId: number;
    leadPhone: string;
    phoneNumberId?: string;
  },
): Promise<LeadFixture> {
  const idnetsuiteAdmin = values.idnetsuiteAdmin ?? 501;
  const idProyectoNetsuite = values.idProyectoNetsuite ?? 7001;
  const phoneNumberId = values.phoneNumberId ?? "kapso-phone-501";

  await dataSource.query(
    `INSERT IGNORE INTO admins
      (idnetsuite_admin, id_rol_admin, email_admin, name_admin, status_admin)
     VALUES (?, 1, ?, ?, 1)`,
    [idnetsuiteAdmin, `admin-${idnetsuiteAdmin}@example.test`, `Admin ${idnetsuiteAdmin}`],
  );
  await dataSource.query(
    `INSERT IGNORE INTO proyectos
      (id_ProNetsuite, Nombre_proyecto, estado_proyecto)
     VALUES (?, ?, 1)`,
    [idProyectoNetsuite, `Proyecto ${idProyectoNetsuite}`],
  );
  await dataSource.query(
    `INSERT IGNORE INTO kapso_phone_numbers
      (phone_number_id, display_phone_number, project_external_id)
     VALUES (?, ?, ?)`,
    [phoneNumberId, `+${values.leadPhone}`, `project-${idProyectoNetsuite}`],
  );

  const phones = (await dataSource.query("SELECT id FROM kapso_phone_numbers WHERE phone_number_id = ?", [phoneNumberId])) as Array<{
    id: number;
  }>;

  await dataSource.query(
    `INSERT IGNORE INTO admin_kapso_integrations
      (idnetsuite_admin, id_kapso_phone_number, status_admin_kapso_integration)
     VALUES (?, ?, 1)`,
    [idnetsuiteAdmin, phones[0].id],
  );
  await dataSource.query(
    `INSERT INTO kapso_business_flow_projects
      (flow_uuid, id_proyecto, id_proyecto_netsuite, project_name, enabled)
     VALUES (?, NULL, ?, ?, 1)
     ON DUPLICATE KEY UPDATE enabled = 1`,
    [FLOW_UUID, idProyectoNetsuite, `Proyecto ${idProyectoNetsuite}`],
  );
  const insertLead = await dataSource.query(
    `INSERT INTO leads
      (idinterno_lead, id_empleado_lead, telefono_lead, idproyecto_lead,
       proyecto_lead, nombre_lead, segimineto_lead,
       whatsapp_template_contact_sent, estado_lead)
     VALUES (?, ?, ?, ?, ?, ?, '01-LEAD-INTERESADO', 2, 1)`,
    [
      values.internalLeadId,
      idnetsuiteAdmin,
      values.leadPhone,
      idProyectoNetsuite,
      `Proyecto ${idProyectoNetsuite}`,
      `Lead ${values.internalLeadId}`,
    ],
  );

  return {
    idProyectoNetsuite,
    idnetsuiteAdmin,
    internalLeadId: values.internalLeadId,
    leadId: Number(insertLead.insertId),
    leadPhone: values.leadPhone,
    phoneNumberId,
  };
}

async function reserveAndMarkSent(repository: KapsoLeadAutomationRepository, fixture: LeadFixture): Promise<{ executionId: number }> {
  const reservation = await repository.reserveInitialTemplateSend({
    flowUuid: FLOW_UUID,
    leadId: fixture.leadId,
    internalLeadId: fixture.internalLeadId,
    idnetsuiteAdmin: fixture.idnetsuiteAdmin,
    idProyectoNetsuite: fixture.idProyectoNetsuite,
    phoneNumberId: fixture.phoneNumberId,
    leadPhoneNumber: fixture.leadPhone,
  });

  if (!reservation) {
    throw new Error("Expected lead execution reservation");
  }

  await repository.markInitialTemplateSent({
    executionId: reservation.executionId,
    responsePayload: { ok: true },
  });

  return reservation;
}

async function createRealApp(
  databaseName: string,
  syncServiceMock: {
    handlePhoneNumberCreatedEvent: jest.Mock;
    handlePhoneNumberDeletedEvent: jest.Mock;
    processInboundMessageWebhook: jest.Mock;
  },
): Promise<INestApplication> {
  process.env.MYSQL_DATABASE = databaseName;
  process.env.MYSQL_MIGRATIONS_RUN = "false";
  process.env.REDIS_HOST ??= "127.0.0.1";
  process.env.REDIS_PORT ??= "6379";
  process.env.KAPSO_PUBLIC_BASE_URL ??= "http://localhost:8002";
  process.env.KAPSO_MEDIA_SIGNING_SECRET = "integration_media_signing_secret_32_chars";
  process.env.KAPSO_PLATFORM_WEBHOOK_SECRET = "integration_platform_secret";
  process.env.KAPSO_WHATSAPP_WEBHOOK_SECRET = "integration_whatsapp_secret";
  process.env.ENTRA_TENANT_ID = "00000000-0000-4000-8000-000000000001";
  process.env.ENTRA_API_AUDIENCE = "00000000-0000-4000-8000-000000000002";
  process.env.ENTRA_ALLOWED_CLIENT_IDS = "00000000-0000-4000-8000-000000000003";

  const { AppModule } = await import("../../src/app.module");
  const queueMock = {
    removeJobScheduler: jest.fn(),
    upsertJobScheduler: jest.fn(),
    waitUntilReady: jest.fn().mockResolvedValue(undefined),
  };
  const authServiceMock = {
    authenticate: jest.fn(async (token: string) => {
      if (token !== "admin-token" && token !== "viewer-token") {
        throw new UnauthorizedException("Invalid integration token");
      }

      return {
        idAdmin: token === "admin-token" ? 1 : 2,
        idNetSuiteAdmin: token === "admin-token" ? 501 : 502,
        roleId: token === "admin-token" ? 1 : 2,
        email: token === "admin-token" ? "admin@example.test" : "viewer@example.test",
        name: token === "admin-token" ? "Admin" : "Viewer",
        entraObjectId: null,
      };
    }),
  };

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(EntraAuthService)
    .useValue(authServiceMock)
    .overrideProvider(getQueueToken(KAPSO_JOBS_QUEUE))
    .useValue(queueMock)
    .overrideProvider(KapsoJobsSchedulerService)
    .useValue({ onModuleInit: jest.fn() })
    .overrideProvider(KapsoJobsProcessor)
    .useValue({})
    .overrideProvider(KapsoSyncService)
    .useValue(syncServiceMock)
    .compile();

  const application = moduleRef.createNestApplication({ rawBody: true });
  application.setGlobalPrefix("api/v1");
  application.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false,
    }),
  );
  await application.init();

  return application;
}

type JwksFixture = {
  keyId: string;
  privateKey: KeyObject;
  server: Server;
  url: string;
};

async function createJwksFixture(): Promise<JwksFixture> {
  const keyId = "integration-key";
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const jwk = publicKey.export({ format: "jwk" });
  const server = createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(
      JSON.stringify({
        keys: [
          {
            ...jwk,
            alg: "RS256",
            kid: keyId,
            use: "sig",
          },
        ],
      }),
    );
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address() as AddressInfo;

  return {
    keyId,
    privateKey,
    server,
    url: `http://127.0.0.1:${address.port}/jwks`,
  };
}

async function closeServer(server: Server | undefined): Promise<void> {
  if (!server) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
