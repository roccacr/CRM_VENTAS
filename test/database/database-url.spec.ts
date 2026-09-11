import { buildDatabaseUrlFromMysqlEnv, buildRuntimeDatabaseUrl } from "../../src/database/database-url";

describe("buildDatabaseUrlFromMysqlEnv", () => {
    it("returns an existing DATABASE_URL without rebuilding it", () => {
        const url = buildDatabaseUrlFromMysqlEnv({
            DATABASE_URL: "mysql://user:pass@host:3306/db",
        });

        expect(url).toBe("mysql://user:pass@host:3306/db");
    });

    it("builds a MySQL URL from existing MYSQL_* values", () => {
        const url = buildDatabaseUrlFromMysqlEnv({
            MYSQL_HOST: "127.0.0.1",
            MYSQL_PORT: "3306",
            MYSQL_USER: "crm user",
            MYSQL_PASSWORD: "p@ss word",
            MYSQL_DATABASE: "crm-db",
        });

        expect(url).toBe("mysql://crm%20user:p%40ss%20word@127.0.0.1:3306/crm-db");
    });

    it("returns undefined when required MYSQL_* values are missing", () => {
        const url = buildDatabaseUrlFromMysqlEnv({
            MYSQL_HOST: "127.0.0.1",
            MYSQL_USER: "crm",
        });

        expect(url).toBeUndefined();
    });

    it("prefers MYSQL_* values over DATABASE_URL for runtime Prisma connections", () => {
        const url = buildRuntimeDatabaseUrl({
            DATABASE_URL: "mysql://wrong:wrong@wrong-host:3306/wrong-db",
            MYSQL_HOST: "127.0.0.1",
            MYSQL_PORT: "3306",
            MYSQL_USER: "crm",
            MYSQL_PASSWORD: "real password",
            MYSQL_DATABASE: "crm-db",
        });

        expect(url).toBe("mysql://crm:real%20password@127.0.0.1:3306/crm-db");
    });

    it("returns undefined when MYSQL_PORT is not a usable TCP port", () => {
        expect(
            buildDatabaseUrlFromMysqlEnv({
                MYSQL_HOST: "127.0.0.1",
                MYSQL_PORT: "abc",
                MYSQL_USER: "crm",
                MYSQL_PASSWORD: "pass",
                MYSQL_DATABASE: "crm-db",
            }),
        ).toBeUndefined();
    });

    it("treats an empty DATABASE_URL as absent for scripts", () => {
        expect(
            buildDatabaseUrlFromMysqlEnv({
                DATABASE_URL: "",
                MYSQL_HOST: "127.0.0.1",
                MYSQL_PORT: "3306",
                MYSQL_USER: "crm",
                MYSQL_PASSWORD: "pass",
                MYSQL_DATABASE: "crm-db",
            }),
        ).toBe("mysql://crm:pass@127.0.0.1:3306/crm-db");
    });
});
