const userAgent = process.env.npm_config_user_agent ?? "";

const PNPM_USER_AGENT_PREFIX = "pnpm/";

/**
 * Bloquea installs y scripts con npm/yarn para el proyecto API standalone.
 *
 * API y frontend son intencionalmente proyectos pnpm separados. Este guard
 * evita que npm cree `package-lock.json` o cambie la resolucion de dependencias.
 */
if (!userAgent.startsWith(PNPM_USER_AGENT_PREFIX)) {
    console.error("Este proyecto debe instalarse y ejecutarse con pnpm.");
    process.exit(1);
}
