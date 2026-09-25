import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { type Kysely, sql } from "kysely";

import { APPROVED_DATABASE_NAME } from "../../src/config/product.constants.js";

const schemaPath = fileURLToPath(new URL("../../Arquitectura/SQL/001_identity_schema_p0_s1.sql", import.meta.url));

// El runner solo puede reproducir CREATE TABLE desde el artefacto SQL aprobado.
// DML, usuarios, grants, drops y SQL improvisado quedan fuera por diseno.
const allowedSchemaStatementPattern = /^\s*CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\b/i;
const createTableNamePattern = /^\s*CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+`?([A-Za-z0-9_]+)`?\s*\(/i;

type SqlQuote = "'" | '"' | "`";

/**
 * Escapa texto fijo antes de usarlo dentro de RegExp.
 */
const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Elimina comentarios de linea antes de validar prefijos de sentencia.
 */
export const stripLineComments = (source: string): string => source.replace(/^\s*--.*$/gm, "");

/**
 * Elimina seleccion/creacion de base desde el artefacto SQL de arquitectura.
 *
 * El runner recibe la base desde variables de entorno y doble confirmacion; por
 * eso el cuerpo ejecutable debe mantenerse estrictamente schema-only.
 */
export const stripDatabaseSelection = (source: string): string => {
    const databaseName = escapeRegExp(APPROVED_DATABASE_NAME);
    const createDatabasePattern = new RegExp(`CREATE\\s+DATABASE\\s+IF\\s+NOT\\s+EXISTS\\s+\`?${databaseName}\`?[\\s\\S]*?;\\s*`, "i");
    const useDatabasePattern = new RegExp(`USE\\s+\`?${databaseName}\`?\\s*;\\s*`, "i");

    return source.replace(createDatabasePattern, "").replace(useDatabasePattern, "");
};

/**
 * Indica si el caracter abre/cierra un literal SQL.
 */
const isSqlQuote = (char: string): char is SqlQuote => char === "'" || char === '"' || char === "`";

/**
 * Calcula el estado de comillas para el parser minimo de sentencias.
 *
 * No intenta ser un parser SQL completo; solo evita cortar sentencias en un
 * punto y coma que este dentro de un literal revisado del artefacto aprobado.
 */
const nextQuoteState = (char: string, previous: string, currentQuote: SqlQuote | null): SqlQuote | null => {
    if (!isSqlQuote(char) || previous === "\\") {
        return currentQuote;
    }

    if (currentQuote === char) {
        return null;
    }

    return currentQuote ?? char;
};

/**
 * Agrega una sentencia no vacia al acumulador.
 */
const pushStatement = (statements: string[], statementSource: string): void => {
    const statement = statementSource.trim();

    if (statement) {
        statements.push(statement);
    }
};

/**
 * Divide SQL en sentencias sin romper punto y coma dentro de comillas.
 */
export const splitSqlStatements = (source: string): string[] => {
    const statements: string[] = [];
    let current = "";
    let quote: SqlQuote | null = null;
    let previous = "";

    for (const char of source) {
        quote = nextQuoteState(char, previous, quote);

        if (char === ";" && quote === null) {
            pushStatement(statements, current);
            current = "";
            previous = char;
            continue;
        }

        current = `${current}${char}`;
        previous = char;
    }

    pushStatement(statements, current);

    return statements;
};

/**
 * Carga y valida el SQL schema-only aprobado.
 *
 * Validar por lista blanca de sentencias es mas estricto que buscar palabras
 * prohibidas: las FK de MySQL contienen legitimamente `ON UPDATE` y `ON DELETE`.
 */
const loadSchemaStatements = async (): Promise<string[]> => {
    const source = await readFile(schemaPath, "utf8");
    const schemaOnlySource = stripLineComments(stripDatabaseSelection(source));

    const statements = splitSqlStatements(schemaOnlySource);

    if (statements.some((statement) => !allowedSchemaStatementPattern.test(statement))) {
        throw new Error("La migracion de identidad solo permite sentencias CREATE TABLE IF NOT EXISTS.");
    }

    return statements;
};

/**
 * Extrae nombres de tablas objetivo desde sentencias CREATE TABLE validadas.
 */
export const readTargetTableNames = (statements: string[]): string[] => {
    const tableNames = statements.map((statement) => createTableNamePattern.exec(statement)?.[1]).filter((tableName): tableName is string => Boolean(tableName));

    if (tableNames.length !== statements.length) {
        throw new Error("La migracion de identidad debe poder extraer el nombre de tabla de cada sentencia CREATE TABLE.");
    }

    return tableNames;
};

/**
 * Falla si el esquema ya tiene tablas objetivo sin registro de migracion.
 *
 * `CREATE TABLE IF NOT EXISTS` es idempotente, pero podria ocultar drift si se
 * ejecuta sobre una base parcialmente creada. El runner solo debe crear desde
 * vacio o saltar una migracion ya registrada en `conf_schema_migration`.
 */
const assertTargetTablesDoNotExist = async (db: Kysely<unknown>, tableNames: string[]): Promise<void> => {
    if (tableNames.length === 0) {
        throw new Error("La migracion de identidad no encontro tablas objetivo en el artefacto SQL.");
    }

    const result = await sql<{ table_name: string }>`
        SELECT TABLE_NAME AS table_name
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME IN (${sql.join(tableNames)})
    `.execute(db);

    if (result.rows.length > 0) {
        const existingTables = result.rows
            .map((row) => row.table_name)
            .sort()
            .join(", ");
        throw new Error(`La migracion schema-only requiere una base vacia o una migracion ya registrada. Tablas existentes: ${existingTables}.`);
    }
};

/**
 * Migracion schema-only de identidad.
 *
 * `sql.raw` se permite solo aqui porque la fuente es el artefacto SQL revisado
 * y cada sentencia se valida por lista blanca antes de ejecutarse. Controllers
 * y repositories no deben copiar este patron para SQL dirigido por requests.
 */
export const identitySchemaMigration = {
    name: "202609250001_identity_schema",
    async up(db: Kysely<unknown>): Promise<void> {
        const statements = await loadSchemaStatements();
        await assertTargetTablesDoNotExist(db, readTargetTableNames(statements));

        for (const statement of statements) {
            await sql.raw(statement).execute(db);
        }
    },
};
