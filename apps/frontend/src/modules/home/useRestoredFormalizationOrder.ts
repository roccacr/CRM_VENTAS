import { useEffect, useState } from "react";

import { ApiClientError } from "../../services/api/api-client";
import { type FollowUpItem, getFollowUp } from "../../services/formalization/follow-up-service";

type RestoreOptions = { readonly record?: FollowUpItem | null; readonly refreshVersion?: number };
function restoreRequest(initialTarget: string | null, options: RestoreOptions) {
    const target = options.record?.id ?? initialTarget;
    return { target, key: String(target) + ":" + String(options.refreshVersion ?? 0) };
}

/** Rehydrate an exact, authorized resource from the URL, never from a provider ID or browser storage. */
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
        void getFollowUp({ recordId: target, search: "", projectId: "", queue: "all", page: 1, pageSize: 1 }).then(
            (result) => {
                if (!active) return;
                const item = result.items[0];
                if (item) {
                    if (managedRecord) setInitialTarget(null);
                    onRestore(item);
                }
                setSettled({ key, status: item ? "ready" : "missing" });
            },
            (error: unknown) => {
                if (active) setSettled({ key, status: error instanceof ApiClientError && [401, 403].includes(error.status) ? "denied" : "error" });
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
