import { useEffect, useRef, useState } from "react";

import { getDatabaseOrder } from "../../services/formalization/database-order-service";
import { getNetsuiteOrder, type NetsuiteOrderIdentity } from "../../services/formalization/netsuite-order-service";

function locationIdentity(): NetsuiteOrderIdentity | null {
    const query = new URLSearchParams(window.location.search);
    const source = query.get("orderSource");
    const id = query.get("orderId");
    return id && (source === "native" || source === "legacy") ? { source, id } : null;
}
/** Only our query keys are changed; module path, unrelated filters and browser history state survive. */
function writeLocation(identity: NetsuiteOrderIdentity | null, netsuiteId?: string): void {
    const url = new URL(window.location.href);
    for (const key of ["orderSource", "orderId", "netsuiteId"]) url.searchParams.delete(key);
    if (identity) {
        url.searchParams.set("orderSource", identity.source);
        url.searchParams.set("orderId", identity.id.replace(/^legacy:/, ""));
        if (netsuiteId) url.searchParams.set("netsuiteId", netsuiteId);
    }
    window.history.replaceState(window.history.state, "", url);
}
export type NetsuiteOrderLoadStatus = "idle" | "loading" | "success" | "error";

/** One bounded request per open identity; status belongs only to that identity. No persisted payload. */
export function useNetsuiteOrderConsole(record: NetsuiteOrderIdentity | null, enabled: boolean, refreshVersion = 0): NetsuiteOrderLoadStatus {
    const [initial] = useState(locationIdentity);
    const target = record ?? initial;
    const source = target?.source;
    const id = target?.id;
    const [settled, setSettled] = useState<{ key: string; status: "success" | "error" } | null>(null);
    const available = [import.meta.env.DEV, enabled, source, id].every(Boolean);
    const pending = useRef<{ key: string; netsuite: ReturnType<typeof getNetsuiteOrder>; database: ReturnType<typeof getDatabaseOrder> } | null>(null);
    useEffect(() => {
        if (!import.meta.env.DEV || !enabled || !source || !id) return;
        const identity = { source, id };
        const key = source + ":" + id + ":" + String(refreshVersion);
        let active = true;
        writeLocation(identity);
        if (pending.current?.key !== key) {
            pending.current = { key, netsuite: getNetsuiteOrder(identity), database: getDatabaseOrder(identity) };
        }
        const flight = pending.current;
        void Promise.allSettled([
            flight.netsuite.then((result) => {
                if (!active) return;
                writeLocation(identity, result.order.netsuiteId);
                console.log("[NetSuite: orden de venta]", result);
            }),
            flight.database.then((result) => {
                if (active) console.log("[Base de datos: orden de venta]", result);
            }),
        ]).then((results) => {
            if (pending.current === flight) pending.current = null;
            if (!active) return;
            const failed = results.some((result) => result.status === "rejected");
            setSettled({ key, status: failed ? "error" : "success" });
            results.forEach((result, index) => {
                if (result.status === "rejected") console.error(index === 0 ? "[NetSuite: orden de venta] No fue posible consultar la orden; no se modificaron datos." : "[Base de datos: orden de venta] No fue posible consultar la orden; no se modificaron datos.");
            });
        });
        return () => {
            active = false;
            setSettled(null);
            writeLocation(null);
        };
    }, [source, id, enabled, initial, refreshVersion]);
    if (!available) return "idle";
    return settled?.key === String(source) + ":" + String(id) + ":" + String(refreshVersion) ? settled.status : "loading";
}
