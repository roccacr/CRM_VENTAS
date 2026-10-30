import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import { vi } from "vitest";

const ROOT = fileURLToPath(new URL("../../../src/integrations/netsuite/suitescript/", import.meta.url));
const CABINET_ROOT = "/SuiteScripts/CRM TINK/";
export const SANDBOX_ACCOUNT = "4552704_SB1";

/** Ejecuta el AMD real de un archivo (ruta relativa a suitescript/) resolviendo sus dependencias con proveedores falsos. */
export function loadAmd(relativePath, providers, cache = new Map()) {
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
        if (!(dependency in providers)) throw new Error(`Proveedor nativo sin simular: ${dependency}`);
        return providers[dependency];
    });
    const exported = captured.factory(...resolved);
    cache.set(file, exported);
    return exported;
}

export function runtimeMock({ accountId = SANDBOX_ACCOUNT, envType = "SANDBOX", parameter } = {}) {
    return {
        accountId,
        envType,
        EnvType: { SANDBOX: "SANDBOX" },
        getCurrentScript: vi.fn(() => ({
            getParameter: vi.fn(() => parameter),
        })),
    };
}

export function logMock() {
    return { debug: vi.fn(), audit: vi.fn(), error: vi.fn() };
}

/** record.load devuelve un record falso con campos de cuerpo y `lineCount` lineas de item. */
export function recordMock({ fields = {}, texts = {}, lineCount = 1, loadError } = {}) {
    const rec = {
        getValue: vi.fn(({ fieldId }) => fields[fieldId] ?? null),
        getText: vi.fn(({ fieldId }) => texts[fieldId] ?? null),
        getLineCount: vi.fn(() => lineCount),
        getSublistText: vi.fn(({ fieldId, line }) => `${fieldId}-t${line}`),
        getSublistValue: vi.fn(({ fieldId, line }) => (fieldId === "quantity" ? line + 1 : `${fieldId}-v${line}`)),
    };
    return {
        rec,
        load: vi.fn(() => {
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
