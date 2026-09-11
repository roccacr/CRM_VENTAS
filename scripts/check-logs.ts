import "../src/config/load-env";

import { existsSync, mkdirSync } from "node:fs";

import { resolveApiLogFile, resolveLogDir } from "../src/common/logging/log-files";

const logDir = resolveLogDir();
const apiLogFile = resolveApiLogFile(logDir);

mkdirSync(logDir, { recursive: true });

console.log(
    JSON.stringify(
        {
            apiLogFile,
            apiLogFileExists: existsSync(apiLogFile),
            logDir,
            logDirExists: existsSync(logDir),
        },
        null,
        2,
    ),
);
