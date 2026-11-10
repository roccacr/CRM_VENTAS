import { useEffect, useRef, useState } from "react";

import { ApiClientError } from "../../services/api/api-client";
import { getDatabaseOrder } from "../../services/formalization/database-order-service";
import { getNetsuiteOrder, type NetsuiteOrderIdentity } from "../../services/formalization/netsuite-order-service";
import { type NetsuitePrimary, readNetsuitePrimary } from "../../services/formalization/netsuite-primary";

function locationIdentity(): NetsuiteOrderIdentity | null {
    const query = new URLSearchParams(window.location.search);
    const source = query.get("orderSource");
    const id = query.get("orderId");
    return id && (source === "native" || source === "legacy") ? { source, id } : null;
}
/** Solo cambian nuestras claves de consulta. La ruta del módulo, los filtros ajenos y el estado del historial del navegador se quedan. */
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
interface OrderRead {
    status: NetsuiteOrderLoadStatus;
    primary: NetsuitePrimary | null;
    errorMessage?: string | undefined;
}

/** Reutiliza las lecturas autorizadas para el diagnóstico y los campos primarios. Una carga vieja o en refresco no se pinta. */
export function useNetsuiteOrderConsole(record: NetsuiteOrderIdentity | null, enabled: boolean, refreshVersion = 0): OrderRead {
    const [initial] = useState(locationIdentity);
    const target = record ?? initial;
    const source = target?.source;
    const id = target?.id;
    const [settled, setSettled] = useState<(OrderRead & { key: string }) | null>(null);
    const available = [enabled, source, id].every(Boolean);
    const pending = useRef<{ key: string; netsuite: ReturnType<typeof getNetsuiteOrder>; database: ReturnType<typeof getDatabaseOrder> } | null>(null);
    useEffect(() => {
        if (!enabled || !source || !id) return;
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
                if (import.meta.env.DEV) console.log("[NetSuite: orden de venta]", result);
                return readNetsuitePrimary(result);
            }),
            flight.database.then((result) => {
                if (active && import.meta.env.DEV) console.log("[Base de datos: orden de venta]", result);
            }),
        ]).then((results) => {
            if (pending.current === flight) pending.current = null;
            if (!active) return;
            const failed = results.some((result) => result.status === "rejected");
            const provider = results[0];
            setSettled({ key, status: failed ? "error" : "success", primary: provider.status === "fulfilled" ? (provider.value ?? null) : null, errorMessage: provider.status === "rejected" ? missingOrderMessage(provider.reason) : undefined });
            results.forEach((result, index) => {
                if (import.meta.env.DEV && result.status === "rejected") console.error(index === 0 ? "[NetSuite: orden de venta] No fue posible consultar la orden; no se modificaron datos." : "[Base de datos: orden de venta] No fue posible consultar la orden; no se modificaron datos.");
            });
        });
        return () => {
            active = false;
            setSettled(null);
            writeLocation(null);
        };
    }, [source, id, enabled, initial, refreshVersion]);
    return currentRead(available, String(source) + ":" + String(id) + ":" + String(refreshVersion), settled);
}
function currentRead(available: boolean, key: string, settled: (OrderRead & { key: string }) | null): OrderRead {
    if (!available) return { status: "idle", primary: null };
    if (settled?.key !== key) return { status: "loading", primary: null };
    return { status: settled.status, primary: settled.status === "success" ? settled.primary : null, errorMessage: settled.errorMessage };
}

/** Un tiempo agotado o un 404 genérico no prueban que el registro del proveedor no exista. */
function missingOrderMessage(failure: unknown): string | undefined {
    if (!(failure instanceof ApiClientError) || failure.status !== 404) return undefined;
    const body = failure.responseBody;
    if (body !== null && typeof body === "object" && Reflect.get(body, "code") === "NETSUITE_SALES_ORDER_NOT_FOUND") return "La orden de venta no existe en NetSuite en el entorno configurado.";
    return undefined;
}
