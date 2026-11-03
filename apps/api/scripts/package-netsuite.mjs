import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const SOURCE = fileURLToPath(new URL("../src/integrations/netsuite/suitescript/", import.meta.url));
const NATIVE = new Set(["N/runtime", "N/record", "N/search", "N/log", "N/https", "N/crypto/random", "N/format"]);
const CABINET_ROOT = "/SuiteScripts/CRM TINK/";

/** Valida sintaxis y grafo AMD real sin ejecutar acciones ni conectar con NetSuite. */
export function inspectSuiteScripts(source = SOURCE) {
    const root = realpathSync(source);
    const files = new Map();
    const visiting = new Set();

    function visit(candidate) {
        const file = realpathSync(candidate);
        const local = relative(root, file);
        if (local.startsWith("..") || isAbsolute(local)) throw new Error("Dependencia fuera de suitescript");
        if (visiting.has(file)) throw new Error(`Dependencia circular: ${local}`);
        if (files.has(file)) return;
        visiting.add(file);
        const content = readFileSync(file, "utf8");
        // Compila sintaxis y lee el AST; no ejecuta define ni sus callbacks.
        const tree = ts.createSourceFile(local, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
        if (tree.parseDiagnostics.length) throw new Error(`Sintaxis invalida: ${local}`);
        const calls = tree.statements.filter((statement) => ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression) && ts.isIdentifier(statement.expression.expression) && statement.expression.expression.text === "define");
        if (calls.length !== 1) throw new Error(`Se requiere un define: ${local}`);
        const [names, factory] = calls[0].expression.arguments;
        if (!names || !ts.isArrayLiteralExpression(names) || !factory || !(ts.isArrowFunction(factory) || ts.isFunctionExpression(factory)) || !names.elements.every((element) => ts.isStringLiteral(element))) throw new Error(`AMD invalido: ${local}`);
        const dependencies = names.elements.map((element) => element.text);
        for (const dependency of dependencies) {
            if (NATIVE.has(dependency)) continue;
            if (dependency.startsWith(CABINET_ROOT)) visit(join(root, `${dependency.slice(CABINET_ROOT.length)}.js`));
            else if (dependency.startsWith(".")) visit(resolve(dirname(file), `${dependency}.js`));
            else throw new Error(`Dependencia no permitida: ${dependency}`);
        }
        visiting.delete(file);
        const path = local.replaceAll("\\", "/");
        files.set(file, {
            source: file,
            path: ["SS2_1_RL_CRM_Integracion.js", "SS2_1_UE_CRM_CambiosRegistros.js"].includes(path) ? `SuiteScripts/${path}` : `SuiteScripts/CRM TINK/${path}`,
            sha256: createHash("sha256").update(content).digest("hex"),
        });
    }

    visit(join(root, "SS2_1_RL_CRM_Integracion.js"));
    visit(join(root, "SS2_1_UE_CRM_CambiosRegistros.js"));
    // Validar tambien modulos presentes aunque todavia no esten conectados a una accion.
    function walk(folder) {
        for (const item of readdirSync(folder, { withFileTypes: true })) {
            if (item.isSymbolicLink()) throw new Error("No se permiten enlaces simbolicos en el paquete");
            if (item.isDirectory()) walk(join(folder, item.name));
            else if (item.name.endsWith(".js")) visit(join(folder, item.name));
        }
    }
    walk(join(root, "lib"));
    walk(join(root, "modules"));
    const logging = readFileSync(join(root, "lib/SS2_1_LIB_CRM_Logs.js"), "utf8");
    const version = /const SCRIPT_VERSION = "([0-9.]+)";/.exec(logging)?.[1];
    if (!version) throw new Error("Falta SCRIPT_VERSION en el logger");
    return { version, files: [...files.values()].sort((a, b) => a.path.localeCompare(b.path)) };
}

/** ZIP local para importar desde la raiz del Archivador; nunca publica ni lee credenciales. */
function packageSuiteScripts() {
    const manifest = inspectSuiteScripts();
    if (process.platform !== "win32") throw new Error("El empaquetado ZIP usa PowerShell en Windows");
    const output = fileURLToPath(new URL("../dist/netsuite/", import.meta.url));
    mkdirSync(output, { recursive: true });
    const archive = join(output, `CRM_v2_${manifest.version}_${Date.now()}.zip`);
    const stage = mkdtempSync(join(tmpdir(), "crm-netsuite-"));
    try {
        for (const file of manifest.files) {
            const target = join(stage, file.path);
            mkdirSync(dirname(target), { recursive: true });
            copyFileSync(file.source, target);
            if (createHash("sha256").update(readFileSync(target)).digest("hex") !== file.sha256) {
                throw new Error(`El archivo cambio durante el empaquetado: ${file.path}`);
            }
        }
        writeFileSync(join(stage, "manifest.json"), JSON.stringify({ version: manifest.version, files: manifest.files.map(({ path, sha256 }) => ({ path, sha256 })) }, null, 2));
        const zipped = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "$ErrorActionPreference='Stop'; Compress-Archive -LiteralPath (Get-ChildItem -LiteralPath $env:CRM_PACKAGE_STAGE | Select-Object -ExpandProperty FullName) -DestinationPath $env:CRM_PACKAGE_ZIP"], {
            env: { ...process.env, CRM_PACKAGE_STAGE: stage, CRM_PACKAGE_ZIP: archive },
            encoding: "utf8",
        });
        if (zipped.error) throw zipped.error;
        if (zipped.status !== 0) throw new Error(zipped.stderr || "No se pudo crear el ZIP");
        process.stdout.write(`Paquete validado: ${archive}\nVersion: ${manifest.version}; archivos JS: ${manifest.files.length}\nImportar desde la RAIZ del Archivador, no dentro de CRM TINK.\n`);
    } finally {
        rmSync(stage, { recursive: true, force: true });
    }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) packageSuiteScripts();
