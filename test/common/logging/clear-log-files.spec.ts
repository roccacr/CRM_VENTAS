import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { clearLogFiles } from "../../../src/common/logging/clear-log-files";

describe("clearLogFiles", () => {
    let tempDir: string;

    beforeEach(() => {
        tempDir = mkdtempSync(join(tmpdir(), "api-kapso-clear-"));
    });

    afterEach(() => {
        rmSync(tempDir, { force: true, recursive: true });
    });

    it("removes log files inside the configured log directory", () => {
        writeFileSync(join(tempDir, "api-kapso.log"), "one");
        writeFileSync(join(tempDir, "start-dev-verify.err.log"), "two");

        expect(clearLogFiles(tempDir)).toEqual({ removed: 2 });
        expect(readdirSync(tempDir)).toEqual([]);
    });

    it("keeps nested folders and non-log files untouched", () => {
        mkdirSync(join(tempDir, "archive"));
        writeFileSync(join(tempDir, "notes.txt"), "keep");
        writeFileSync(join(tempDir, "api-kapso.log"), "remove");

        expect(clearLogFiles(tempDir)).toEqual({ removed: 1 });
        expect(existsSync(join(tempDir, "archive"))).toBe(true);
        expect(existsSync(join(tempDir, "notes.txt"))).toBe(true);
    });

    it("creates the log directory when it does not exist", () => {
        const missingDir = join(tempDir, "missing");

        expect(clearLogFiles(missingDir)).toEqual({ removed: 0 });
        expect(existsSync(missingDir)).toBe(true);
    });

    it("does not delete a directory whose name ends with .log", () => {
        mkdirSync(join(tempDir, "archive.log"));
        writeFileSync(join(tempDir, "api-kapso.log"), "remove");

        expect(clearLogFiles(tempDir)).toEqual({ removed: 1 });
        expect(existsSync(join(tempDir, "archive.log"))).toBe(true);
    });

    it("does not delete .log.bak, .txt or uppercase .LOG files", () => {
        writeFileSync(join(tempDir, "api-kapso.log.bak"), "keep");
        writeFileSync(join(tempDir, "notes.txt"), "keep");
        writeFileSync(join(tempDir, "OTHER.LOG"), "keep");
        writeFileSync(join(tempDir, "api-kapso.log"), "remove");

        expect(clearLogFiles(tempDir)).toEqual({ removed: 1 });
        expect(existsSync(join(tempDir, "api-kapso.log.bak"))).toBe(true);
        expect(existsSync(join(tempDir, "notes.txt"))).toBe(true);
        expect(existsSync(join(tempDir, "OTHER.LOG"))).toBe(true);
    });
});
