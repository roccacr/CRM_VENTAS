import { ConfigService } from "@nestjs/config";
import { Job, Queue } from "bullmq";

import { KAPSO_JOB_NAMES, KAPSO_JOB_SCHEDULERS } from "../../src/modules/kapso/common/kapso-jobs.constants";
import { KapsoJobsProcessor } from "../../src/modules/kapso/services/kapso-jobs.processor";
import { KapsoJobsSchedulerService } from "../../src/modules/kapso/services/kapso-jobs-scheduler.service";
import { KapsoLeadAutomationService } from "../../src/modules/kapso/services/kapso-lead-automation.service";
import { KapsoPhoneNumberSyncService } from "../../src/modules/kapso/services/kapso-phone-number-sync.service";

describe("Kapso jobs", () => {
  it("registra los dos schedulers con intervalos configurados", async () => {
    const queue = {
      upsertJobScheduler: jest.fn().mockResolvedValue(undefined),
      removeJobScheduler: jest.fn().mockResolvedValue(undefined),
    };
    const config = {
      get: jest.fn((key: string, fallback: number) => {
        const values: Record<string, number> = {
          "kapso.pendingSyncIntervalMs": 15_000,
          "kapso.leadTemplateIntervalMs": 45_000,
        };
        return values[key] ?? fallback;
      }),
    };
    const scheduler = new KapsoJobsSchedulerService(queue as unknown as Queue, config as unknown as ConfigService);

    await scheduler.onModuleInit();

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

  it("elimina un scheduler cuando su intervalo está desactivado", async () => {
    const queue = {
      upsertJobScheduler: jest.fn().mockResolvedValue(undefined),
      removeJobScheduler: jest.fn().mockResolvedValue(undefined),
    };
    const config = {
      get: jest.fn((key: string, fallback: number) => (key === "kapso.pendingSyncIntervalMs" ? 0 : fallback)),
    };
    const scheduler = new KapsoJobsSchedulerService(queue as unknown as Queue, config as unknown as ConfigService);

    await scheduler.onModuleInit();

    expect(queue.removeJobScheduler).toHaveBeenCalledWith(KAPSO_JOB_SCHEDULERS.pendingRemoteSync);
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
