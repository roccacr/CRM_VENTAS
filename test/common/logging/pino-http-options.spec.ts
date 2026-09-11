import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createPinoHttpOptions } from "../../../src/common/logging/pino-http-options";

type PinoTransportTarget = {
    readonly options?: {
        readonly destination?: number | string;
        readonly mkdir?: boolean;
    };
    readonly target: string;
};

function readTransportTargets(options: ReturnType<typeof createPinoHttpOptions>): PinoTransportTarget[] {
    const transport = options.transport as unknown as { readonly targets: PinoTransportTarget[] };

    return transport.targets;
}

describe("createPinoHttpOptions", () => {
    let tempDir: string;

    beforeEach(() => {
        tempDir = mkdtempSync(join(tmpdir(), "api-kapso-logs-"));
    });

    afterEach(() => {
        rmSync(tempDir, { force: true, recursive: true });
    });

    it("writes development logs to console and logs/api-kapso.log", () => {
        const options = createPinoHttpOptions({
            logLevel: "debug",
            logDir: tempDir,
            nodeEnv: "development",
        });

        expect(options.level).toBe("debug");
        const targets = readTransportTargets(options);

        expect(targets.some((target) => target.target === "pino-pretty")).toBe(true);
        expect(targets.some((target) => target.target === "pino/file" && target.options?.destination === join(tempDir, "api-kapso.log") && target.options.mkdir === true)).toBe(true);
    });

    it("keeps production JSON console logs and writes a file copy", () => {
        const options = createPinoHttpOptions({
            logLevel: "info",
            logDir: tempDir,
            nodeEnv: "production",
        });

        const targets = readTransportTargets(options);

        expect(targets.some((target) => target.target === "pino/file" && target.options?.destination === 1)).toBe(true);
        expect(targets.some((target) => target.target === "pino/file" && target.options?.destination === join(tempDir, "api-kapso.log") && target.options.mkdir === true)).toBe(true);
    });

    it("redacts auth headers and Kapso signatures from file logs", () => {
        const options = createPinoHttpOptions({
            logLevel: "info",
            logDir: tempDir,
            nodeEnv: "development",
        });

        const redact = options.redact as { readonly censor: string; readonly paths: readonly string[] };

        expect(redact.censor).toBe("[redacted]");
        expect(redact.paths).toEqual(expect.arrayContaining(["req.headers.authorization", "req.headers.x-api-key", "req.headers.x-webhook-signature", "req.headers.x-crm-api-token"]) as unknown);
    });
});
