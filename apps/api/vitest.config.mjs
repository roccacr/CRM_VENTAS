import { defineConfig } from "vitest/config";

// Opt-in persistence suites share .env MySQL and rollback-only Owner fixtures.
const realMysqlTests = [process.env.IDENTITY_ACCESS_MYSQL_TESTS, process.env.ADMINISTRATION_MYSQL_TESTS, process.env.CATALOG_MYSQL_TESTS].includes("1");

export default defineConfig({
    test: { fileParallelism: !realMysqlTests },
});
