import { describe, expect, it } from "vitest";

import { buildAddendumSentAlter, formalizationAddendumSentMigration } from "../../migrations/schema-only/202611030072_formalization_addendum_sent.js";
import { parseLegacyAddendumSentArgs } from "../../scripts/migrate-legacy-addendum-sent.js";
import { selectSchemaMigrations } from "../../scripts/run-schema-migrations.js";
const metadata = { type: "enum('pending','completed','cancelled')", nullable: "YES", defaultValue: null, extra: "", charset: "utf8mb4", collation: "utf8mb4_unicode_ci", comment: "Estado d'adendum \\ original" };
describe("072 schema contract", () => {
    it("appends sent preserving indices and metadata", () => {
        expect(buildAddendumSentAlter(metadata, "native")).toContain("ENUM('pending','completed','cancelled','sent') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT 'Estado d''adendum");
    });
    it("accepts completed retry", () => {
        expect(buildAddendumSentAlter({ ...metadata, type: "enum('pending','completed','cancelled','sent')" }, "legacy")).toBeNull();
    });
    it.each([{ type: "varchar(30)" }, { nullable: "NO" }, { defaultValue: "pending" }, { extra: "INVISIBLE" }, { collation: "unsafe;sql" }])("rejects drift %j", (changes) => {
        expect(() => buildAddendumSentAlter({ ...metadata, ...changes }, "native")).toThrow("drift");
    });
    it("guards CLI and selection", () => {
        expect(parseLegacyAddendumSentArgs(["--plan"])).toBe(false);
        expect(parseLegacyAddendumSentArgs(["--apply=crmdatabase-api"])).toBe(true);
        expect(() => parseLegacyAddendumSentArgs(["--apply"])).toThrow("Use exactly --plan or --apply=crmdatabase-api");
        expect(selectSchemaMigrations(formalizationAddendumSentMigration.name)).toEqual([formalizationAddendumSentMigration]);
    });
});
