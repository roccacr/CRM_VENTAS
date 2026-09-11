/**
 * Fail-closed para env en Playwright (espejo de requireConfiguredSecret en HTTP).
 *
 * Sin el secret/token, el test mentiría (401/500 ambiguos). Mejor fallar el setup
 * con un mensaje claro: "falta configuración", no "cliente inválido".
 */
export function requireEnv(name: string): string {
    const value = process.env[name]?.trim();

    if (!value) {
        throw new Error(`${name} is required for this Playwright test`);
    }

    return value;
}
