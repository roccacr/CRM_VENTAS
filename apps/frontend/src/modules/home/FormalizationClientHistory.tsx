import Button from "antd/es/button";
import Card from "antd/es/card";
import { useEffect, useRef, useState } from "react";

import type { ClientHistoryPage } from "../../services/formalization/database-order-service";
import type { NetsuiteOrderIdentity } from "../../services/formalization/netsuite-order-service";
import { getOrderClientDetail } from "../../services/formalization/order-client-service";

/** Las fechas de origen son observaciones. No se inventan marcas UTC. */
export function FormalizationClientHistory({ initial, identity }: { readonly initial: ClientHistoryPage | null; readonly identity: NetsuiteOrderIdentity }) {
    const [page, setPage] = useState(initial);
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);
    const active = useRef(true);
    useEffect(() => {
        active.current = true;
        return () => {
            active.current = false;
        };
    }, []);
    async function more() {
        if (loading) return;
        const cursor = page?.nextCursor;
        if (!cursor) return;
        setLoading(true);
        setFailed(false);
        try {
            const result = await getOrderClientDetail(identity, cursor);
            const next = requiredHistory(result.history);
            if (active.current) setPage((previous) => mergePage(previous, next));
        } catch {
            if (active.current) setFailed(true);
        }
        if (active.current) setLoading(false);
    }
    return (
        <Card size="small" title="Bitácora del cliente">
            {!page ? (
                <p className="client-history__empty">Bitácora no disponible.</p>
            ) : (
                <>
                    <p className="client-history__note">Registros vinculados al cliente. Las fechas del sistema anterior conservan su hora de origen, sin zona horaria confirmada.</p>
                    {page.legacyAvailable === false && (
                        <p role="status" className="client-history__note client-history__note--warn">
                            La conexión al sistema anterior está deshabilitada. Se muestran únicamente los registros conservados en Habita.
                        </p>
                    )}
                    {!page.items.length && <p className="client-history__empty">No hay registros de bitácora disponibles.</p>}
                    <ol className="client-history">
                        {page.items.map((entry) => (
                            <HistoryEntry key={entry.id} entry={entry} />
                        ))}
                    </ol>
                    {failed && <p role="alert">No se pudo cargar el siguiente tramo. Puedes reintentar.</p>}
                    {page.hasMore && (
                        <Button
                            loading={loading}
                            onClick={() => {
                                void more();
                            }}
                        >
                            Cargar más registros
                        </Button>
                    )}
                </>
            )}
        </Card>
    );
}

function mergePage(previous: ClientHistoryPage | null, next: ClientHistoryPage): ClientHistoryPage {
    const items = previous?.items ?? [];
    return { ...next, items: [...items, ...next.items.filter((entry) => !items.some((old) => old.id === entry.id))] };
}
function HistoryEntry({ entry }: { readonly entry: ClientHistoryPage["items"][number] }) {
    const date = entry.occurredAt ? new Date(entry.occurredAt).toLocaleString("es-CR", { timeZone: "America/Costa_Rica", dateStyle: "medium", timeStyle: "short" }) : (entry.sourceDate ?? "Sin fecha conocida");
    const actor = entry.actorName ?? "Responsable no registrado";
    return (
        <li data-source={entry.source}>
            <div className="client-history__head">
                <strong>{entry.reason?.name ?? entry.action}</strong>
                <time>{date}</time>
            </div>
            <p className="client-history__detail" data-empty={!entry.detail}>
                {entry.detail ?? "Sin detalle registrado"}
            </p>
            <StatusChange entry={entry} />
            <p className="client-history__meta">
                <span data-empty={!entry.actorName}>{actor}</span>
                <ActorCoverage entry={entry} />
                <span className="client-history__source">{entry.source === "legacy" ? "Sistema anterior" : "Habita"}</span>
            </p>
        </li>
    );
}
function ActorCoverage({ entry }: { readonly entry: ClientHistoryPage["items"][number] }) {
    return entry.actorName && entry.actorCoverage === "current_directory" ? <small>Nombre del directorio actual</small> : null;
}
function StatusChange({ entry }: { readonly entry: ClientHistoryPage["items"][number] }) {
    if (!entry.fromStatus && !entry.toStatus) return null;
    return (
        <p className="client-history__change" aria-label="Cambio de estado">
            {entry.fromStatus && <span>{entry.fromStatus}</span>}
            {entry.fromStatus && entry.toStatus && <span aria-hidden="true">→</span>}
            {entry.toStatus && <span className="client-history__to">{entry.toStatus}</span>}
        </p>
    );
}

function requiredHistory(page: ClientHistoryPage | null | undefined): ClientHistoryPage {
    if (!page) throw new Error("Historial no disponible");
    return page;
}
