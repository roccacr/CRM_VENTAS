import { isIP } from "node:net";

/**
 * Entorno NetSuite a partir de la configuracion ya validada.
 *
 * Habita es produccion aunque `NETSUITE_ENVIRONMENT` diga sandbox. Un frontend
 * de loopback es sandbox aunque la variable diga produccion. El header del
 * navegador no entra en esta decision: solo el origen configurado y la variable
 * de entorno. Cualquier otro valor de la variable corta el arranque.
 */
export function resolveNetsuiteEnvironment(frontendOrigin: unknown, configured: unknown): "production" | "sandbox" {
    if (typeof frontendOrigin === "string") {
        if (frontendOrigin === "https://habita.roccacr.com") return "production";
        if (isLocalFrontend(frontendOrigin)) return "sandbox";
    }
    if (configured === undefined || configured === "production") return "production";
    if (configured === "sandbox") return "sandbox";
    throw new Error("Invalid NetSuite environment");
}

/**
 * Loopback sin DNS y sin datos del request. Acepta `localhost`, un subdominio
 * `.localhost`, `[::1]` y `127.0.0.0/8`, solo en HTTP o HTTPS. Una URL rota no
 * es local: cae en la variable de entorno, que por defecto es produccion.
 */
function isLocalFrontend(value: string): boolean {
    try {
        const url = new URL(value);
        if (!["http:", "https:"].includes(url.protocol)) return false;
        const host = url.hostname.replace(/\.$/, "");
        return [host === "localhost", host.endsWith(".localhost"), host === "[::1]", isIP(host) === 4 && host.startsWith("127.")].some(Boolean);
    } catch {
        return false;
    }
}

/**
 * RESTlet de la cuenta Habita, y solo de esa cuenta. Sandbox es `4552704-sb1`;
 * produccion es `4552704`.
 *
 * La URL tiene que coincidir entera: sin espacios, sin credenciales, sin path
 * distinto y sin parametros ademas de `script` y `deploy`, en cualquier orden.
 * Un query extra podria sacar la llamada de la cuenta aprobada.
 */
export function isNetsuiteRestletUrl(value: unknown, environment: "production" | "sandbox"): value is string {
    if (typeof value !== "string" || /\s/.test(value)) return false;
    const script = "(?:[1-9][0-9]*|customscript_[A-Za-z0-9_]+)";
    const deploy = "(?:[1-9][0-9]*|customdeploy_[A-Za-z0-9_]+)";
    const account = environment === "sandbox" ? "4552704-sb1" : "4552704";
    return new RegExp("^https://" + account + "\\.restlets\\.api\\.netsuite\\.com/app/site/hosting/restlet\\.nl\\?(?:script=" + script + "&deploy=" + deploy + "|deploy=" + deploy + "&script=" + script + ")$").test(value);
}
