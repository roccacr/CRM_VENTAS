import { useEffect, useState } from "react";

import { ApiClientError } from "../../services/api/api-client";
import { type FollowUpItem, getFormalizationOrderRecord } from "../../services/formalization/follow-up-service";

type RestoreOptions = { readonly record?: FollowUpItem | null; readonly refreshVersion?: number };
function restoreRequest(initialTarget: string | null, options: RestoreOptions) {
    const target = options.record?.id ?? initialTarget;
    return { target, key: String(target) + ":" + String(options.refreshVersion ?? 0) };
}

/** Rehidrata un recurso exacto y autorizado desde la URL. No usa un id de proveedor ni el almacenamiento del navegador. */
export function useRestoredFormalizationOrder(enabled: boolean, onRestore: (item: FollowUpItem) => void, options: RestoreOptions = {}) {
    const [initialTarget, setInitialTarget] = useState(() => {
        const query = new URLSearchParams(window.location.search);
        const source = query.get("orderSource");
        const id = query.get("orderId");
        if ([source, id].every((value) => !value)) return null;
        const valid = source === "legacy" ? /^[1-9][0-9]{0,9}$/.test(id ?? "") : source === "native" ? /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(id ?? "") : false;
        return valid ? (source === "legacy" ? "legacy:" + String(id) : String(id)) : "invalid";
    });
    const { target, key } = restoreRequest(initialTarget, options);
    const managedRecord = "record" in options;
    const [settled, setSettled] = useState<{ key: string; status: string } | null>(null);
    useEffect(() => {
        if (!enabled || !target || target === "invalid") return;
        let active = true;
        void getFormalizationOrderRecord(target.startsWith("legacy:") ? "legacy" : "native", target.replace(/^legacy:/, "")).then(
            (item) => {
                if (!active) return;
                if (managedRecord) setInitialTarget(null);
                onRestore(item);
                setSettled({ key, status: "ready" });
            },
            (error: unknown) => {
                if (active) setSettled({ key, status: error instanceof ApiClientError && [401, 403].includes(error.status) ? "denied" : error instanceof ApiClientError && error.status === 404 ? "missing" : "error" });
            },
        );
        return () => {
            active = false;
        };
    }, [enabled, target, onRestore, key, managedRecord]);
    if (!target) return "idle";
    if (!enabled) return "denied";
    if (target === "invalid") return "missing";
    return settled?.key === key ? settled.status : "loading";
}
