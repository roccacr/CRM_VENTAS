import "../src/config/load-env";

import { clearLogFiles } from "../src/common/logging/clear-log-files";
import { resolveLogDir } from "../src/common/logging/log-files";

const logDir = resolveLogDir();
const result = clearLogFiles(logDir);

console.log(JSON.stringify({ logDir, ...result }, null, 2));
