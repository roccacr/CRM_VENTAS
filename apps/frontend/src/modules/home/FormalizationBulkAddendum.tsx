import Button from "antd/es/button";
import { useEffect, useRef, useState } from "react";

import { ApiClientError } from "../../services/api/api-client";
import type { FollowUpItem } from "../../services/formalization/follow-up-service";
import { markSelectedOrderAddendumPending, type OrderAddendum, type PendingAddendumCommand, previewSelectedOrderAddendums } from "../../services/formalization/order-addendum-service";
import { AddendumReasonInput, AddendumReasonModal } from "./FormalizationMarkAddendum";

interface Entry {
    readonly item: FollowUpItem;
    readonly snapshot: OrderAddendum | null;
    readonly warning: string | null;
    readonly status: "ready" | "blocked" | "marked" | "failed" | "uncertain";
    readonly message: string;
    readonly command?: PendingAddendumCommand;
}

function pendingWarning(snapshot: OrderAddendum): string | null {
    if (!snapshot.canMarkPending) return "Sin permiso para marcar adéndum.";
    if (snapshot.availableForPending !== true) return "La orden no está disponible para marcación. Actualiza el listado.";
    return snapshot.status === "pending" ? "Ya tiene un adéndum pendiente. Se renovará con el motivo común y quedará en bitácora." : null;
}

function prepare(item: FollowUpItem, snapshot: OrderAddendum | null): Entry {
    if (snapshot) {
        const blocked = !snapshot.canMarkPending || snapshot.availableForPending !== true;
        const warning = pendingWarning(snapshot);
        return { item, snapshot, warning, status: blocked ? "blocked" : "ready", message: blocked ? "No se marcará: requiere resolver la advertencia." : "Por marcar" };
    }
    return { item, snapshot: null, warning: "No fue posible verificar la orden y sus permisos.", status: "blocked", message: "No se marcará: actualiza la información antes de volver a intentar." };
}

function failedEntry(entry: Entry, error: unknown): Entry {
    // Un rechazo del reintento no demuestra que la petición anterior no se haya confirmado.
    if (entry.status === "uncertain") return { ...entry, message: "La marcación anterior sigue sin confirmar. No se pudo verificar su resultado; conserva esta operación para reintentar." };
    const definite = error instanceof ApiClientError && [400, 401, 403, 404, 409].includes(error.status);
    return { ...entry, status: definite ? "failed" : "uncertain", message: definite ? "No marcada: la orden, versión o permisos cambiaron. Actualiza la información." : "Sin confirmar: reintenta la misma operación para verificar si se guardó." };
}

async function saveEntry(entry: Entry, note: string): Promise<Entry> {
    if (!entry.snapshot || !["ready", "uncertain"].includes(entry.status)) return entry;
    const command = entry.command ?? { source: entry.snapshot.source, id: entry.snapshot.id, expectedVersion: entry.snapshot.version, operationId: crypto.randomUUID(), note: note.trim() };
    const attempt = { ...entry, command };
    try {
        const saved = await markSelectedOrderAddendumPending(command);
        const stillPending = saved.status === "pending" && saved.note === command.note;
        return { ...attempt, status: "marked", message: stillPending ? "Marcada como adéndum pendiente. Motivo registrado en bitácora." : "Marcación confirmada en bitácora; la orden cambió después. Consulta su estado y motivo actuales." };
    } catch (error) {
        return failedEntry(attempt, error);
    }
}

function useBulkAddendum(items: readonly FollowUpItem[], onSaved: () => void) {
    const [entries, setEntries] = useState<readonly Entry[] | null>(null);
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [refreshError, setRefreshError] = useState(false);
    const running = useRef(false);
    const generation = useRef(0);
    useEffect(() => {
        const current = ++generation.current;
        void (async () => {
            const prepared: Entry[] = [];
            // Cien lecturas por petición, sin relajar límites HTTP ni las validaciones de cada orden.
            for (let offset = 0; offset < items.length; offset += 100) {
                const batch = items.slice(offset, offset + 100);
                try {
                    const snapshots = await previewSelectedOrderAddendums(batch);
                    prepared.push(...batch.map((item, index) => prepare(item, snapshots[index] ?? null)));
                } catch {
                    prepared.push(...batch.map((item) => prepare(item, null)));
                }
                if (current !== generation.current) return;
            }
            setEntries(prepared);
        })();
        return () => {
            generation.current += 1;
        };
    }, [items]);
    const save = async () => {
        if ([!entries, running.current, note.trim().length < 3, note.trim().length > 2000].some(Boolean)) return;
        running.current = true;
        setBusy(true);
        setSubmitted(true);
        const current = generation.current;
        const next = [...(entries ?? [])];
        try {
            for (const [index, entry] of next.entries()) {
                next[index] = await saveEntry(entry, note);
                if (current !== generation.current) return;
                setEntries([...next]);
            }
            if (next.some((entry) => entry.status === "marked")) {
                try {
                    onSaved();
                } catch {
                    setRefreshError(true);
                }
            }
        } finally {
            running.current = false;
            if (current === generation.current) setBusy(false);
        }
    };
    return { entries, note, setNote, busy, submitted, refreshError, save };
}

/** Cantidad de órdenes con su singular correcto. */
const selectedOrdersLabel = (count: number): string => (count === 1 ? "1 orden seleccionada" : `${String(count)} órdenes seleccionadas`);

/** Conserva un comando por orden: los éxitos no se repiten y los resultados inciertos reutilizan su operación. */
export function FormalizationBulkAddendum({ items, onClose, onSaved }: { readonly items: readonly FollowUpItem[]; readonly onClose: () => void; readonly onSaved: () => void }) {
    const model = useBulkAddendum(items, onSaved);
    const retry = model.entries?.some((entry) => entry.status === "uncertain") === true;
    const confirmLabel = retry ? "Reintentar sin confirmar" : "Marcar pendientes";
    const actionable = model.entries?.some((entry) => entry.status === "ready" || entry.status === "uncertain") === true;
    const canSave = [actionable, !model.busy, model.note.trim().length >= 3, model.note.trim().length <= 2000].every(Boolean);
    return (
        <AddendumReasonModal
            open
            width={800}
            className="formalization-modal formalization-bulk-addendum"
            title="Marcar como adéndum pendiente"
            onCancel={() => {
                if (!model.busy) onClose();
            }}
            closable={!model.busy}
            mask={{ closable: !model.busy }}
            keyboard={!model.busy}
            footer={
                <>
                    <Button disabled={model.busy} onClick={onClose}>
                        Cerrar
                    </Button>
                    <Button
                        type="primary"
                        aria-label={confirmLabel}
                        disabled={!canSave}
                        loading={model.busy}
                        onClick={() => {
                            void model.save();
                        }}
                    >
                        {confirmLabel}
                    </Button>
                </>
            }
        >
            <div className="formalization-bulk-addendum__intro">
                <span className="formalization-bulk-addendum__count">{selectedOrdersLabel(items.length)}</span>
                <p>Revisa las órdenes y escribe el motivo que se aplicará a todas.</p>
            </div>
            <BulkReadNotice entries={model.entries} total={items.length} />
            <BulkOrderDetails items={items} entries={model.entries} />
            <div className="formalization-form formalization-bulk-addendum__reason">
                <AddendumReasonInput value={model.note} disabled={[!model.entries, model.busy, model.submitted, !actionable].some(Boolean)} onChange={model.setNote} />
                <p>El mismo motivo quedará registrado en la bitácora de cada orden. Entre 3 y 2000 caracteres.</p>
            </div>
            {model.submitted && <BulkSummary entries={model.entries ?? []} />}
            {retry && <p role="alert">Hay resultados sin confirmar. Reintenta antes de cerrar para conservar la misma operación y evitar renovar una marca ya guardada.</p>}
            {model.refreshError && <p role="alert">Los cambios se guardaron. Actualiza el listado para consultar los contadores.</p>}
        </AddendumReasonModal>
    );
}

function BulkReadNotice({ entries, total }: { readonly entries: readonly Entry[] | null; readonly total: number }) {
    if (!entries) return <p role="status">Consultando condiciones, versiones y permisos de {total} órdenes…</p>;
    const warnings = entries.filter((entry) => entry.warning);
    return (
        warnings.length > 0 && (
            <div role="alert" className="formalization-bulk-addendum__notice">
                <strong>Órdenes con advertencias</strong>
                <ul>
                    {warnings.map((entry) => (
                        <li key={`${entry.item.source}:${entry.item.id}`}>
                            {entry.item.number}: {entry.warning}
                        </li>
                    ))}
                </ul>
                <p>Los permisos, la disponibilidad y la versión vigente siguen siendo obligatorios.</p>
            </div>
        )
    );
}

function BulkOrderDetails({ items, entries }: { readonly items: readonly FollowUpItem[]; readonly entries: readonly Entry[] | null }) {
    return (
        <div className="formalization-bulk-addendum__orders" role="region" aria-label="Detalle de órdenes seleccionadas" tabIndex={0}>
            <table className="formalization-grid formalization-bulk-addendum__table">
                <thead>
                    <tr>
                        <th scope="col">Orden / Cliente</th>
                        <th scope="col">Proyecto / Unidad</th>
                        <th scope="col">Resultado</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, index) => (
                        <tr key={`${item.source}:${item.id}`}>
                            <td data-label="Orden / Cliente">
                                <strong className="formalization-bulk-addendum__primary">{item.number}</strong>
                                <span className="formalization-bulk-addendum__secondary">{item.client ?? "Sin cliente"}</span>
                            </td>
                            <td data-label="Proyecto / Unidad">
                                <span className="formalization-bulk-addendum__primary">{item.project?.name ?? "Sin proyecto"}</span>
                                <span className="formalization-bulk-addendum__secondary">{item.unit ?? "Sin unidad"}</span>
                            </td>
                            <td data-label="Resultado">
                                <BulkOrderResult entry={entries?.[index]} />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

const resultLabels: Record<Entry["status"], string> = { ready: "Por marcar", blocked: "No disponible", marked: "Confirmada", failed: "No marcada", uncertain: "Sin confirmar" };
function BulkOrderResult({ entry }: { readonly entry: Entry | undefined }) {
    if (!entry) return <span className="formalization-bulk-addendum__secondary">Consultando…</span>;
    return (
        <div className="formalization-bulk-addendum__result">
            <span className="formalization-bulk-addendum__status" data-state={entry.status}>
                {resultLabels[entry.status]}
            </span>
            {entry.status !== "ready" && <span className="formalization-bulk-addendum__secondary">{entry.message}</span>}
        </div>
    );
}

function BulkSummary({ entries }: { readonly entries: readonly Entry[] }) {
    return (
        <p role="status" className="formalization-bulk-addendum__summary">
            Marcadas: {entries.filter((entry) => entry.status === "marked").length}. No marcadas: {entries.filter((entry) => ["blocked", "failed"].includes(entry.status)).length}. Sin confirmar: {entries.filter((entry) => entry.status === "uncertain").length}.
        </p>
    );
}
