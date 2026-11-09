import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import { vi } from "vitest";

const ROOT = fileURLToPath(new URL("../../../src/integrations/netsuite/suitescript/", import.meta.url));
const CABINET_ROOT = "/SuiteScripts/";
export const SANDBOX_ACCOUNT = "4552704_SB1";
export const EVENT_TEST_ID = "11111111-1111-4111-8111-111111111111";
export const EVENT_FIELDS = Object.fromEntries(["custbody90", "custbody51", "custbody91", "custbody105", "custbody43", "custbody103", "custbody_ix_comision_pagada", "custbody_entrega_de_llaves", "custbody274", "custbody_cuotas_pagadas"].map((field) => [field, false]));
export const EVENT_PROVIDERS = { "N/crypto/random": { generateUUID: () => EVENT_TEST_ID }, "N/format": { Type: { DATETIME: "datetime" }, parse: ({ value }) => new Date(value) } };

/** Ejecuta el AMD real de un archivo (ruta relativa a suitescript/) resolviendo sus dependencias con proveedores falsos. */
export function loadAmd(relativePath, providers = {}, cache = new Map()) {
    const file = resolve(ROOT, relativePath);
    if (cache.has(file)) return cache.get(file);
    let captured;
    runInNewContext(
        readFileSync(file, "utf8"),
        {
            define: (dependencies, factory) => {
                captured = { dependencies, factory };
            },
        },
        { filename: file },
    );
    if (!captured) throw new Error(`define() no fue llamado por ${relativePath}`);
    const resolved = captured.dependencies.map((dependency) => {
        if (dependency.startsWith(CABINET_ROOT)) return loadAmd(dependency.slice(CABINET_ROOT.length) + ".js", providers, cache);
        if (dependency.startsWith(".")) return loadAmd(resolve(dirname(file), dependency + ".js"), providers, cache);
        if (dependency in providers) return providers[dependency];
        if (dependency in EVENT_PROVIDERS) return EVENT_PROVIDERS[dependency];
        if (["N/runtime", "N/https", "N/log", "N/record", "N/search", "N/workflow"].includes(dependency)) return {};
        throw new Error(`Proveedor nativo sin simular: ${dependency}`);
    });
    const exported = captured.factory(...resolved);
    cache.set(file, exported);
    return exported;
}

export function runtimeMock({ accountId = SANDBOX_ACCOUNT, envType = "SANDBOX", parameter = "https://habita.example.test/integrations/netsuite/local", secretId = "custsecret_habita_qa", configuredAccount } = {}) {
    return {
        accountId,
        envType,
        EnvType: { SANDBOX: "SANDBOX", PRODUCTION: "PRODUCTION" },
        getCurrentScript: vi.fn(() => ({
            getParameter: vi.fn(({ name }) => ({ custscript_crm_event_url: parameter, custscript_crm_event_secret_id: secretId, custscript_crm_account_id: configuredAccount })[name]),
        })),
    };
}

export function logMock() {
    return { debug: vi.fn(), audit: vi.fn(), error: vi.fn() };
}

/** record.load devuelve un record falso con campos de cuerpo y `lineCount` lineas de item. */
export function recordMock({ fields = {}, texts = {}, lineCount = 1, loadError } = {}) {
    const rec = {
        getValue: vi.fn(({ fieldId }) => fields[fieldId] ?? (fieldId === "currency" ? 1 : fieldId === "trandate" ? new Date(2026, 10, 2) : (EVENT_FIELDS[fieldId] ?? null))),
        getText: vi.fn(({ fieldId }) => texts[fieldId] ?? null),
        getSublists: vi.fn(() => ["item", "salesteam"]),
        getLineCount: vi.fn(({ sublistId }) => (sublistId === "salesteam" ? 1 : lineCount)),
        getSublistText: vi.fn(({ fieldId, line }) => `${fieldId}-t${line}`),
        getSublistValue: vi.fn(({ fieldId, line }) => (fieldId === "employee" ? "70" : fieldId === "quantity" ? line + 1 : `${fieldId}-v${line}`)),
    };
    return {
        rec,
        load: vi.fn((options) => {
            if (options?.type === "currency") return { getValue: () => "USD" };
            if (loadError) throw loadError;
            return rec;
        }),
        submitFields: vi.fn(),
    };
}

/** lookupFields devuelve `flags`, o lo que dicte `impl(arg, n)` (n = numero de llamada, desde 1). */
export function searchMock(flags = {}, impl) {
    let calls = 0;
    return {
        lookupFields: vi.fn((arg) => {
            calls += 1;
            if (arg.columns.includes("lastmodifieddate")) return { lastmodifieddate: "2026-11-02T20:00:00.000Z", ...EVENT_FIELDS, ...flags };
            if (impl) return impl(arg, calls);
            return Object.fromEntries(arg.columns.map((column) => [column, flags[column]]));
        }),
    };
}

export function nsError(name) {
    const error = new Error(`RAW ${name} SECRET`);
    error.name = name;
    return error;
}

export const READY = {
    custbody43: false,
    custbody_aprueba_jefe_ventas: true,
    custbodyid_firma_rocca: true,
    custbodyid_firma_rc: false,
};
