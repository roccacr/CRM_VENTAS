import pino from "pino";
import { describe, expect, it } from "vitest";

import { APP_LOG_REDACT_PATHS, appLogPresentation } from "../../src/config/app-logging.constants.js";

describe("application log presentation", () => {
    it("prints readable JSON in development without HTTP header noise or secrets", () => {
        const lines: string[] = [];
        const logger = pino({ ...appLogPresentation("development"), redact: { paths: APP_LOG_REDACT_PATHS, censor: "[REDACTED]" } }, { write: (line: string) => lines.push(line) });
        logger.info({ req: { id: "request-1", method: "POST", url: "/integrations/netsuite/local/order-events?token=hidden-query", headers: { authorization: "hidden-auth", cookie: "hidden-cookie", "user-agent": "header-noise" } }, res: { statusCode: 200, headers: { "set-cookie": "hidden-response" } }, responseTime: 12, password: "hidden-password" }, "request completed");
        const output = lines.join("");
        expect(output).toContain('\n  "');
        expect(JSON.parse(output)).toMatchObject({ req: { id: "request-1", method: "POST", url: "/integrations/netsuite/local/order-events" }, res: { statusCode: 200 }, responseTime: 12, password: "[REDACTED]" });
        for (const value of ["hidden-query", "hidden-auth", "hidden-cookie", "hidden-response", "hidden-password", "header-noise", '"headers"']) expect(output).not.toContain(value);
    });

    it("keeps NetSuite receipt metadata structured without claiming persistence", () => {
        const lines: string[] = [];
        const logger = pino(appLogPresentation("development"), { write: (line: string) => lines.push(line) });
        logger.info({ event: "netsuite_local_order_received", netsuiteId: "123", eventType: "edit", persisted: false, fields: 79, itemLines: 2 });
        expect(JSON.parse(lines.join(""))).toMatchObject({ event: "netsuite_local_order_received", netsuiteId: "123", eventType: "edit", persisted: false, fields: 79, itemLines: 2 });
    });

    it.each(["production", "test", undefined])("keeps single-line redacted JSON outside development: %s", (environment) => {
        const lines: string[] = [];
        const options = appLogPresentation(environment);
        expect(options.hooks).toBeUndefined();
        const logger = pino({ ...options, redact: { paths: APP_LOG_REDACT_PATHS, censor: "[REDACTED]" } }, { write: (line: string) => lines.push(line) });
        logger.info({ req: { id: "request-2", method: "GET", url: "/identity/microsoft/callback?code=hidden-code", headers: { authorization: "hidden-auth" } } });
        const output = lines.join("");
        expect(output.trim().split("\n")).toHaveLength(1);
        expect(output).not.toContain("hidden-code");
        expect(output).not.toContain("hidden-auth");
        expect(JSON.parse(output)).toMatchObject({ req: { headers: { authorization: "[REDACTED]" } } });
    });

    it("preserves an unexpected log line if formatting cannot parse it", () => {
        expect(appLogPresentation("development").hooks?.streamWrite?.("not-json\n")).toBe("not-json\n");
    });
});
