import { ConfigService } from "@nestjs/config";
import { Job, Queue, QueueEvents, Worker } from "bullmq";
import { createConnection } from "net";

import { KAPSO_JOB_SCHEDULERS } from "../../src/modules/kapso/common/kapso-jobs.constants";
import { KapsoJobsSchedulerService } from "../../src/modules/kapso/services/kapso-jobs-scheduler.service";

const redisHost = process.env.REDIS_HOST ?? "127.0.0.1";
const redisPort = Number(process.env.REDIS_PORT ?? 6379);
const requireRedis = process.env.REQUIRE_REDIS_INTEGRATION === "true";

describe("Kapso Redis integration", () => {
  const queueName = `kapso-jobs-integration-${process.pid}-${Date.now()}`;
  const connection = {
    host: redisHost,
    port: redisPort,
    password: process.env.REDIS_PASSWORD || undefined,
    db: Number(process.env.REDIS_DB ?? 0),
    tls: process.env.REDIS_TLS === "true" ? {} : undefined,
    maxRetriesPerRequest: null,
  };
  let queue: Queue;
  let queueEvents: QueueEvents;
  let worker: Worker;
  let redisAvailable = false;

  beforeAll(async () => {
    redisAvailable = await canConnectTcp(redisHost, redisPort);

    if (!redisAvailable) {
      if (requireRedis) {
        throw new Error(`Redis requerido en ${redisHost}:${redisPort} pero no responde.`);
      }

      return;
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

  it("registra schedulers únicos y procesa un job real una sola vez", async () => {
    if (!redisAvailable) {
      return;
    }

    const configService = {
      get: jest.fn((key: string, fallback: number) => {
        const values: Record<string, number> = {
          "kapso.pendingSyncIntervalMs": 60_000,
          "kapso.leadTemplateIntervalMs": 90_000,
        };
        return values[key] ?? fallback;
      }),
    } as unknown as ConfigService;
    const scheduler = new KapsoJobsSchedulerService(queue, configService);

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
