import { isIP } from "node:net";

/** Trusted deployment configuration only; browser headers never choose ERP credentials. */
export function resolveNetsuiteEnvironment(frontendOrigin: unknown, configured: unknown): "production" | "sandbox" {
    if (typeof frontendOrigin === "string") {
        if (frontendOrigin === "https://habita.roccacr.com") return "production";
        if (isLocalFrontend(frontendOrigin)) return "sandbox";
    }
    if (configured === undefined || configured === "production") return "production";
    if (configured === "sandbox") return "sandbox";
    throw new Error("Invalid NetSuite environment");
}

/** Recognize loopback names/addresses without DNS resolution or browser input. */
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

/** Exact account/deployment allowlist; credentials and extra query parameters are never accepted. */
export function isNetsuiteRestletUrl(value: unknown, environment: "production" | "sandbox"): value is string {
    if (typeof value !== "string" || /\s/.test(value)) return false;
    const script = "(?:[1-9][0-9]*|customscript_[A-Za-z0-9_]+)";
    const deploy = "(?:[1-9][0-9]*|customdeploy_[A-Za-z0-9_]+)";
    const account = environment === "sandbox" ? "4552704-sb1" : "4552704";
    return new RegExp("^https://" + account + "\\.restlets\\.api\\.netsuite\\.com/app/site/hosting/restlet\\.nl\\?(?:script=" + script + "&deploy=" + deploy + "|deploy=" + deploy + "&script=" + script + ")$").test(value);
}
