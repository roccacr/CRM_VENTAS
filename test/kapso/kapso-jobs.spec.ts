import { ConfigService } from "@nestjs/config";
import { ModuleRef } from "@nestjs/core";
import { Job, Queue } from "bullmq";

import { KAPSO_JOB_NAMES, KAPSO_JOB_SCHEDULERS } from "../../src/modules/kapso/common/kapso-jobs.constants";
import { KapsoJobsProcessor } from "../../src/modules/kapso/services/kapso-jobs.processor";
import { KapsoJobsSchedulerService } from "../../src/modules/kapso/services/kapso-jobs-scheduler.service";
import { KapsoLeadAutomationService } from "../../src/modules/kapso/services/kapso-lead-automation.service";
import { KapsoPhoneNumberSyncService } from "../../src/modules/kapso/services/kapso-phone-number-sync.service";

describe("Kapso jobs", () => {
  const createConfig = (values: Record<string, unknown> = {}) =>
    ({
      get: jest.fn((key: string, fallback?: unknown) => values[key] ?? fallback),
    }) as unknown as ConfigService;

  const createScheduler = (configValues: Record<string, unknown>, queue: Partial<Queue> = {}) => {
    const config = createConfig(configValues);
    const moduleRef = {
      get: jest.fn(() => queue),
    } as unknown as ModuleRef;
    const phoneSync = {
      processPendingRemoteSyncs: jest.fn().mockResolvedValue(undefined),
    };
    const leadAutomation = {
      processLeadTemplateCandidates: jest.fn().mockResolvedValue(undefined),
    };
    const scheduler = new KapsoJobsSchedulerService(
      config,
      moduleRef,
      phoneSync as unknown as KapsoPhoneNumberSyncService,
      leadAutomation as unknown as KapsoLeadAutomationService,
    );

    return {
      leadAutomation,
      moduleRef,
      phoneSync,
      scheduler,
    };
  };

  it("registra los dos schedulers BullMQ con intervalos configurados", async () => {
    const queue = {
      removeJobScheduler: jest.fn().mockResolvedValue(undefined),
      upsertJobScheduler: jest.fn().mockResolvedValue(undefined),
    };
    const { moduleRef, scheduler } = createScheduler(
      {
        "kapso.jobsDriver": "bullmq",
        "kapso.leadTemplateIntervalMs": 45_000,
        "kapso.pendingSyncIntervalMs": 15_000,
      },
      queue as Partial<Queue>,
    );

    await scheduler.onModuleInit();

    expect(moduleRef.get).toHaveBeenCalledTimes(1);
    expect(queue.upsertJobScheduler).toHaveBeenCalledTimes(2);
    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      KAPSO_JOB_SCHEDULERS.pendingRemoteSync,
      { every: 15_000 },
      expect.objectContaining({ name: KAPSO_JOB_NAMES.pendingRemoteSync }),
    );
    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      KAPSO_JOB_SCHEDULERS.leadTemplateCandidates,
      { every: 45_000 },
      expect.objectContaining({
        name: KAPSO_JOB_NAMES.leadTemplateCandidates,
      }),
    );
  });

  it("elimina un scheduler BullMQ cuando su intervalo esta desactivado", async () => {
    const queue = {
      removeJobScheduler: jest.fn().mockResolvedValue(undefined),
      upsertJobScheduler: jest.fn().mockResolvedValue(undefined),
    };
    const { scheduler } = createScheduler(
      {
        "kapso.jobsDriver": "bullmq",
        "kapso.pendingSyncIntervalMs": 0,
      },
      queue as Partial<Queue>,
    );

    await scheduler.onModuleInit();

    expect(queue.removeJobScheduler).toHaveBeenCalledWith(KAPSO_JOB_SCHEDULERS.pendingRemoteSync);
  });

  it("ejecuta jobs locales dentro del mismo API sin resolver BullMQ", async () => {
    jest.useFakeTimers();

    const { leadAutomation, moduleRef, phoneSync, scheduler } = createScheduler({
      "kapso.jobsDriver": "local",
      "kapso.leadTemplateIntervalMs": 100,
      "kapso.pendingSyncIntervalMs": 100,
    });

    await scheduler.onModuleInit();
    jest.advanceTimersByTime(100);
    await Promise.resolve();
    await Promise.resolve();

    expect(moduleRef.get).not.toHaveBeenCalled();
    expect(phoneSync.processPendingRemoteSyncs).toHaveBeenCalledTimes(1);
    expect(leadAutomation.processLeadTemplateCandidates).toHaveBeenCalledTimes(1);

    scheduler.onModuleDestroy();
    jest.useRealTimers();
  });

  it("delega cada nombre de job al servicio correcto", async () => {
    const phoneSync = {
      processPendingRemoteSyncs: jest.fn().mockResolvedValue({ processed: 1 }),
    };
    const leadAutomation = {
      processLeadTemplateCandidates: jest.fn().mockResolvedValue({ processed: 2 }),
    };
    const processor = new KapsoJobsProcessor(
      phoneSync as unknown as KapsoPhoneNumberSyncService,
      leadAutomation as unknown as KapsoLeadAutomationService,
    );

    await expect(
      processor.process({
        name: KAPSO_JOB_NAMES.pendingRemoteSync,
      } as Job),
    ).resolves.toEqual({ processed: 1 });
    await expect(
      processor.process({
        name: KAPSO_JOB_NAMES.leadTemplateCandidates,
      } as Job),
    ).resolves.toEqual({ processed: 2 });
    await expect(processor.process({ name: "unknown", id: "job-3" } as Job)).resolves.toEqual({ ignored: true });

    expect(phoneSync.processPendingRemoteSyncs).toHaveBeenCalledTimes(1);
    expect(leadAutomation.processLeadTemplateCandidates).toHaveBeenCalledTimes(1);
  });
});
