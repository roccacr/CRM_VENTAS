import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

import { expect, it } from "vitest";

interface Library {
    environment: { isAuthorizedEnvironment(): boolean };
}
function authorized(accountId: string, parameter: unknown, envType = "PRODUCTION") {
    let library: Library | undefined;
    const runtime = { accountId, envType, EnvType: { PRODUCTION: "PRODUCTION", SANDBOX: "SANDBOX" }, getCurrentScript: () => ({ getParameter: () => parameter }) };
    runInNewContext(readFileSync(new URL("../../src/integrations/netsuite/suitescript/SS2_1_LIB_CRM_habita.js", import.meta.url), "utf8"), {
        define: (_deps: string[], factory: (...args: unknown[]) => Library) => {
            library = factory(runtime, {}, {}, {}, {}, {}, {});
        },
    });
    if (!library) throw new Error("Missing library");
    return library.environment.isAuthorizedEnvironment();
}
it.each(["4552704", 4552704])("authorizes the exact production account with text or numeric parameter %s", (value) => {
    expect(authorized("4552704", value)).toBe(true);
});
it("authorizes the exact sandbox account separately", () => {
    expect(authorized("4552704_SB1", "4552704_SB1", "SANDBOX")).toBe(true);
    expect(authorized("4552704_SB1", 4552704, "SANDBOX")).toBe(false);
});
it.each([false, {}, [], 4552705, 4552704.5, "4552704_SB1", " 4552704"])("rejects a missing, invalid or different production account %j", (value) => {
    expect(authorized("4552704", value)).toBe(false);
});
it("rejects an unsupported environment even for the matching account", () => {
    expect(authorized("4552704", "4552704", "BETA")).toBe(false);
});

it.each([null, undefined, ""])("uses the fixed account for each environment only when the parameter is missing %j", (value) => {
    expect(authorized("4552704", value)).toBe(true);
    expect(authorized("9999999", value)).toBe(false);
    expect(authorized("4552704_SB1", value, "SANDBOX")).toBe(true);
    expect(authorized("OTHER_SB1", value, "SANDBOX")).toBe(false);
    expect(authorized("4552704", value, "SANDBOX")).toBe(false);
});
