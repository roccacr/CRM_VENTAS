import { copyFileSync, mkdirSync, readdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import assert from "node:assert/strict";
import { it } from "vitest";

import { inspectSuiteScripts } from "../../scripts/package-netsuite.mjs";

const source = fileURLToPath(new URL("../../src/integrations/netsuite/suitescript/", import.meta.url));

// cpSync termina el proceso de Node en este entorno Windows; copiar explicitamente los fixtures.
function copyFixture(from, to) {
    mkdirSync(to, { recursive: true });
    for (const item of readdirSync(from, { withFileTypes: true })) {
        if (item.isDirectory()) copyFixture(join(from, item.name), join(to, item.name));
        else copyFileSync(join(from, item.name), join(to, item.name));
    }
}

it("maps all modules to their actual File Cabinet paths with hashes and version", () => {
    const result = inspectSuiteScripts();
    assert.equal(result.version, "2026.10.30.4");
    assert.ok(result.files.some((file) => file.path === "SuiteScripts/SS2_1_RL_CRM_Integracion.js"));
    assert.ok(result.files.some((file) => file.path === "SuiteScripts/CRM TINK/lib/SS2_1_LIB_CRM_Registros.js"));
    assert.ok(result.files.some((file) => file.path === "SuiteScripts/SS2_1_UE_CRM_CambiosRegistros.js"));
    assert.equal(result.files.length, 18);
    assert.ok(result.files.every((file) => /^SS2_1_(RL|LIB|UE)_CRM_[A-Za-z]+\.js$/.test(file.path.split("/").at(-1)) || /^SS2_1_LIB_CRM_OrdenesVenta_[A-Za-z]+\.js$/.test(file.path.split("/").at(-1))));
    assert.ok(result.files.every((file) => /^[a-f0-9]{64}$/.test(file.sha256)));
    assert.equal(
        result.files.some((file) => file.path.includes(".env")),
        false,
    );
});

for (const [name, content] of [
    ["missing dependency", 'define(["./missing"], () => ({}));'],
    ["circular dependency", 'define(["./SS2_1_RL_CRM_Integracion"], () => ({}));'],
    ["unapproved native API", 'define(["N/email"], () => ({}));'],
    ["invalid syntax", "define(["],
]) {
    it(`refuses a package with ${name} before generating a ZIP`, () => {
        const temp = mkdtempSync(join(tmpdir(), "crm-package-test-"));
        try {
            copyFixture(source, temp);
            writeFileSync(join(temp, "SS2_1_RL_CRM_Integracion.js"), content);
            assert.throws(() => inspectSuiteScripts(temp));
        } finally {
            rmSync(temp, { recursive: true, force: true });
        }
    });
}

it("refuses relative dependencies that escape the source directory", () => {
    const temp = mkdtempSync(join(tmpdir(), "crm-package-test-"));
    try {
        const root = join(temp, "scripts");
        copyFixture(source, root);
        writeFileSync(join(temp, "outside.js"), "define([], () => ({}));");
        writeFileSync(join(root, "SS2_1_RL_CRM_Integracion.js"), 'define(["../outside"], () => ({}));');
        assert.throws(() => inspectSuiteScripts(root), /fuera de suitescript/);
    } finally {
        rmSync(temp, { recursive: true, force: true });
    }
});

it("changes the manifest hash when module content changes", () => {
    const temp = mkdtempSync(join(tmpdir(), "crm-package-test-"));
    try {
        copyFixture(source, temp);
        const before = inspectSuiteScripts(temp);
        const file = join(temp, "lib/SS2_1_LIB_CRM_Logs.js");
        writeFileSync(file, `${readFileSync(file, "utf8")}\n// Nueva revision\n`);
        const after = inspectSuiteScripts(temp);
        assert.notEqual(after.files.find((item) => item.source === file)?.sha256, before.files.find((item) => item.source === file)?.sha256);
    } finally {
        rmSync(temp, { recursive: true, force: true });
    }
});
