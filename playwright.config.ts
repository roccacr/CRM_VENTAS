import { defineConfig } from "@playwright/test";

import { DEFAULT_APP_PORT } from "./src/config/app-config.constants";
import { GLOBAL_API_PREFIX } from "./src/config/http.constants";

const baseURL = `http://127.0.0.1:${DEFAULT_APP_PORT}`;

export default defineConfig({
    testDir: "./test/playwright",
    timeout: 30_000,
    use: {
        baseURL,
    },
    webServer: {
        command: "npm run build && npm run start",
        reuseExistingServer: true,
        timeout: 60_000,
        url: `${baseURL}/${GLOBAL_API_PREFIX}/health`,
    },
});
