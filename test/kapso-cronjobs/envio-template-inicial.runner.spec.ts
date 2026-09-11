import { ConfigService } from "@nestjs/config";

import { DEFAULT_ENVIO_TEMPLATE_INICIAL_BATCH_SIZE, DEFAULT_ENVIO_TEMPLATE_INICIAL_INTERVAL_MS } from "../../src/kapso-cronjobs/envio-template-inicial/envio-template-inicial.constants";
import { EnvioTemplateInicialRunner } from "../../src/kapso-cronjobs/envio-template-inicial/envio-template-inicial.runner";
import { EnvioTemplateInicialRunResult } from "../../src/kapso-cronjobs/envio-template-inicial/envio-template-inicial.service";

type EnvValues = Record<string, string | undefined>;

type ServiceMock = {
    readonly runOnce: jest.MockedFunction<(limit: number) => Promise<EnvioTemplateInicialRunResult>>;
};

const completedResult: EnvioTemplateInicialRunResult = {
    failed: 0,
    processed: 0,
    sent: 0,
    skipped: 0,
    status: "completed",
};

const enabledEnv: EnvValues = {
    KAPSO_API_KEY: "kapso-key",
    KAPSO_ENVIO_TEMPLATE_INICIAL_BATCH_SIZE: "3",
    KAPSO_ENVIO_TEMPLATE_INICIAL_ENABLED: "1",
    KAPSO_ENVIO_TEMPLATE_INICIAL_INTERVAL_MS: "1000",
    NODE_ENV: "development",
};

function createConfigService(values: EnvValues): ConfigService {
    return {
        get: jest.fn((key: string): string | undefined => values[key]),
    } as unknown as ConfigService;
}

function createServiceMock(): ServiceMock {
    return {
        runOnce: jest.fn().mockResolvedValue(completedResult),
    };
}

function createRunner(
    env: EnvValues = enabledEnv,
    service: ServiceMock = createServiceMock(),
): {
    readonly runner: EnvioTemplateInicialRunner;
    readonly service: ServiceMock;
} {
    return {
        runner: new EnvioTemplateInicialRunner(createConfigService(env), service as never),
        service,
    };
}

describe("EnvioTemplateInicialRunner", () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it("does not schedule the cronjob in test environment", async () => {
        const { runner, service } = createRunner({ ...enabledEnv, NODE_ENV: "test" });

        runner.onApplicationBootstrap();
        await jest.advanceTimersByTimeAsync(0);

        expect(service.runOnce).not.toHaveBeenCalled();
    });

    it("does not schedule the cronjob when Kapso API key is missing", async () => {
        const { runner, service } = createRunner({ ...enabledEnv, KAPSO_API_KEY: undefined });

        runner.onApplicationBootstrap();
        await jest.advanceTimersByTimeAsync(0);

        expect(service.runOnce).not.toHaveBeenCalled();
    });

    it("runs immediately with the configured batch size when enabled", async () => {
        const { runner, service } = createRunner();

        runner.onApplicationBootstrap();
        await jest.advanceTimersByTimeAsync(0);

        expect(service.runOnce).toHaveBeenCalledTimes(1);
        expect(service.runOnce).toHaveBeenCalledWith(3);
    });

    it("uses safe defaults when interval or batch size are invalid", async () => {
        const { runner, service } = createRunner({
            ...enabledEnv,
            KAPSO_ENVIO_TEMPLATE_INICIAL_BATCH_SIZE: "bad",
            KAPSO_ENVIO_TEMPLATE_INICIAL_INTERVAL_MS: "-1",
        });

        runner.onApplicationBootstrap();
        await jest.advanceTimersByTimeAsync(0);
        await jest.advanceTimersByTimeAsync(DEFAULT_ENVIO_TEMPLATE_INICIAL_INTERVAL_MS);

        expect(service.runOnce).toHaveBeenNthCalledWith(1, DEFAULT_ENVIO_TEMPLATE_INICIAL_BATCH_SIZE);
        expect(service.runOnce).toHaveBeenNthCalledWith(2, DEFAULT_ENVIO_TEMPLATE_INICIAL_BATCH_SIZE);
    });

    it("does not start another cycle until the current run finishes", async () => {
        let finishFirstRun: (result: EnvioTemplateInicialRunResult) => void = () => undefined;
        const firstRun = new Promise<EnvioTemplateInicialRunResult>((resolve) => {
            finishFirstRun = resolve;
        });
        const service = createServiceMock();
        service.runOnce.mockReturnValueOnce(firstRun).mockResolvedValue(completedResult);
        const { runner } = createRunner(enabledEnv, service);

        runner.onApplicationBootstrap();
        await jest.advanceTimersByTimeAsync(0);
        await jest.advanceTimersByTimeAsync(5000);

        expect(service.runOnce).toHaveBeenCalledTimes(1);

        finishFirstRun(completedResult);
        await Promise.resolve();
        await jest.advanceTimersByTimeAsync(1000);

        expect(service.runOnce).toHaveBeenCalledTimes(2);
    });

    it("stops scheduling new cycles after application shutdown", async () => {
        let finishFirstRun: (result: EnvioTemplateInicialRunResult) => void = () => undefined;
        const firstRun = new Promise<EnvioTemplateInicialRunResult>((resolve) => {
            finishFirstRun = resolve;
        });
        const service = createServiceMock();
        service.runOnce.mockReturnValueOnce(firstRun).mockResolvedValue(completedResult);
        const { runner } = createRunner(enabledEnv, service);

        runner.onApplicationBootstrap();
        await jest.advanceTimersByTimeAsync(0);

        runner.onApplicationShutdown();
        finishFirstRun(completedResult);
        await Promise.resolve();
        await jest.advanceTimersByTimeAsync(1000);

        expect(service.runOnce).toHaveBeenCalledTimes(1);
    });

    it.each(["true", "0", undefined])("does not schedule the cronjob when ENABLED is %s", async (enabled) => {
        const { runner, service } = createRunner({ ...enabledEnv, KAPSO_ENVIO_TEMPLATE_INICIAL_ENABLED: enabled });

        runner.onApplicationBootstrap();
        await jest.advanceTimersByTimeAsync(0);

        expect(service.runOnce).not.toHaveBeenCalled();
    });

    it("keeps scheduling the next cycle after runOnce throws", async () => {
        const service = createServiceMock();
        service.runOnce.mockRejectedValueOnce(new Error("Kapso down")).mockResolvedValue(completedResult);
        const { runner } = createRunner(enabledEnv, service);

        runner.onApplicationBootstrap();
        await jest.advanceTimersByTimeAsync(0);
        await jest.advanceTimersByTimeAsync(1000);

        expect(service.runOnce).toHaveBeenCalledTimes(2);
    });
});
