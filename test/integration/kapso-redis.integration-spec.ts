import { ConfigService } from "@nestjs/config";
import { ModuleRef } from "@nestjs/core";
import { Job, Queue, QueueEvents, Worker } from "bullmq";
import { createConnection } from "net";

import { KAPSO_JOB_SCHEDULERS } from "../../src/modules/kapso/common/kapso-jobs.constants";
import { KapsoJobsSchedulerService } from "../../src/modules/kapso/services/kapso-jobs-scheduler.service";
import { KapsoLeadAutomationService } from "../../src/modules/kapso/services/kapso-lead-automation.service";
import { KapsoPhoneNumberSyncService } from "../../src/modules/kapso/services/kapso-phone-number-sync.service";

const redisUrl = process.env.REDIS_URL ? new URL(process.env.REDIS_URL) : undefined;
const redisUrlDb = redisUrl?.pathname.replace("/", "");
const redisHost = redisUrl?.hostname ?? process.env.REDIS_HOST ?? "127.0.0.1";
const redisPort = Number(redisUrl?.port || process.env.REDIS_PORT || 6379);
const requireRedis = process.env.REQUIRE_REDIS_INTEGRATION === "true";
const describeRedis = requireRedis ? describe : describe.skip;

describeRedis("Kapso Redis integration", () => {
  const queueName = `kapso-jobs-integration-${process.pid}-${Date.now()}`;
  const connection = {
    host: redisHost,
    port: redisPort,
    username: redisUrl?.username ? decodeURIComponent(redisUrl.username) : undefined,
    password: redisUrl?.password ? decodeURIComponent(redisUrl.password) : process.env.REDIS_PASSWORD || undefined,
    db: Number(redisUrlDb || process.env.REDIS_DB || 0),
    tls: redisUrl?.protocol === "rediss:" || process.env.REDIS_TLS === "true" ? {} : undefined,
    maxRetriesPerRequest: null,
  };
  let queue: Queue;
  let queueEvents: QueueEvents;
  let worker: Worker;
  let redisAvailable = false;

  beforeAll(async () => {
    redisAvailable = await canConnectTcp(redisHost, redisPort);

    if (!redisAvailable) {
      throw new Error(`Redis requerido en ${redisHost}:${redisPort} pero no responde.`);
    }

    queue = new Queue(queueName, { connection });
    queueEvents = new QueueEvents(queueName, { connection });
    worker = new Worker(queueName, async (job: Job) => ({ processedId: job.id, name: job.name }), {
      connection,
      concurrency: 1,
    });

    await Promise.all([queue.waitUntilReady(), queueEvents.waitUntilReady(), worker.waitUntilReady()]);
  }, 20_000);

  afterAll(async () => {
    if (!redisAvailable) {
      return;
    }

    if (queue) {
      await queue.removeJobScheduler(KAPSO_JOB_SCHEDULERS.pendingRemoteSync);
      await queue.removeJobScheduler(KAPSO_JOB_SCHEDULERS.leadTemplateCandidates);
      await queue.obliterate({ force: true });
    }

    await Promise.all([worker?.close(), queueEvents?.close(), queue?.close()]);
  }, 20_000);

  it("registra schedulers unicos y procesa un job real una sola vez", async () => {
    const configService = {
      get: jest.fn((key: string, fallback?: unknown) => {
        const values: Record<string, unknown> = {
          "kapso.jobsDriver": "bullmq",
          "kapso.pendingSyncIntervalMs": 60_000,
          "kapso.leadTemplateIntervalMs": 90_000,
        };

        return values[key] ?? fallback;
      }),
    } as unknown as ConfigService;
    const moduleRef = { get: jest.fn(() => queue) } as unknown as ModuleRef;
    const phoneNumberSyncService = { processPendingRemoteSyncs: jest.fn() } as unknown as KapsoPhoneNumberSyncService;
    const leadAutomationService = { processLeadTemplateCandidates: jest.fn() } as unknown as KapsoLeadAutomationService;
    const scheduler = new KapsoJobsSchedulerService(configService, moduleRef, phoneNumberSyncService, leadAutomationService);

    await scheduler.onModuleInit();
    await scheduler.onModuleInit();

    const schedulers = await queue.getJobSchedulers();
    const probe = await queue.add("integration-probe", { source: "jest" });
    const result = await probe.waitUntilFinished(queueEvents, 10_000);

    expect(schedulers.map((item) => item.key)).toEqual(
      expect.arrayContaining([KAPSO_JOB_SCHEDULERS.pendingRemoteSync, KAPSO_JOB_SCHEDULERS.leadTemplateCandidates]),
    );
    expect(schedulers).toHaveLength(2);
    expect(result).toEqual({
      processedId: probe.id,
      name: "integration-probe",
    });
  });
});

function canConnectTcp(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    const fail = () => {
      socket.destroy();
      resolve(false);
    };

    socket.setTimeout(1500);
    socket.once("connect", () => {
      socket.end();
      resolve(true);
    });
    socket.once("timeout", fail);
    socket.once("error", fail);
  });
}
