const userAgent = process.env.npm_config_user_agent ?? "";
const execPath = process.env.npm_execpath ?? "";

const PNPM_USER_AGENT_PREFIX = "pnpm/";
const PNPM_EXECUTABLE_MARKER = "pnpm";

/**
 * Bloquea ejecucion de scripts con npm/yarn para el frontend standalone.
 *
 * El repositorio mantiene API y frontend como proyectos pnpm separados. Permitir
 * npm recrearia lockfiles y desviaria la configuracion aprobada del proyecto.
 */
const isPnpm = userAgent.startsWith(PNPM_USER_AGENT_PREFIX) || execPath.toLowerCase().includes(PNPM_EXECUTABLE_MARKER);

if (!isPnpm) {
    console.error("Este proyecto solo permite pnpm. Ejecuta scripts con pnpm, por ejemplo: pnpm run dev.");
    process.exit(1);
}
