import FileTextOutlined from "@ant-design/icons/FileTextOutlined";
import UserOutlined from "@ant-design/icons/UserOutlined";
import Select from "antd/es/select";
import { useEffect, useId, useRef, useState } from "react";

import { FormHelp } from "../../components/forms/FormHelp";
import { ApiClientError } from "../../services/api/api-client";
import { getNoteRelatedRecords, getRelatedRecordOptions, type NoteRecordReference, type NoteRelatedRecord, type NoteRelatedRecords, relatedRecordKey, type RelatedRecordsCommand, saveNoteRelatedRecords } from "../../services/notes/note-related-records-service";
import type { NoteModule } from "../../services/notes/notes-service";
import { useNotesRealtime } from "./useNotesRealtime";

const captions = { lead: "Cliente", sales_order: "Orden" };
const references = (items: readonly NoteRelatedRecord[]): NoteRecordReference[] => items.flatMap((item) => (item.reference && !item.primary ? [item.reference] : []));
function recordCaption(item: NoteRelatedRecord): string {
    if (item.unavailable) return "Registro vinculado no disponible";
    if (item.restricted) return `${captions[item.kind]} vinculado sin acceso`;
    return `${captions[item.kind]}: ${item.label ?? "Registro"}`;
}
/** Un resumen autorizado se reutiliza en las tarjetas, las hojas flotantes y la conversación. */
export function NoteRelatedRecordsSummary({ records = [], compact = false }: { readonly records?: readonly NoteRelatedRecord[] | undefined; readonly compact?: boolean }) {
    if (!records.length) return null;
    const limit = compact ? 2 : records.length;
    return (
        <div className="note-related-records__chips" aria-label="Registros relacionados">
            {records.slice(0, limit).map((item, index) => (
                <RelatedRecordChip item={item} key={item.reference ? relatedRecordKey(item.reference) : index} />
            ))}
            {records.length > limit && (
                <details>
                    <summary>Ver {records.length - limit} más</summary>
                    {records.slice(limit).map((item, index) => (
                        <RelatedRecordChip item={item} key={item.reference ? relatedRecordKey(item.reference) : index} />
                    ))}
                </details>
            )}
        </div>
    );
}
function RelatedRecordChip({ item }: { readonly item: NoteRelatedRecord }) {
    return item.url ? (
        <a className="note-chip note-related-records__chip" href={item.url} title={item.description ?? undefined}>
            {recordCaption(item)}
        </a>
    ) : (
        <span className="note-chip note-related-records__chip" title={item.description ?? undefined}>
            {recordCaption(item)}
        </span>
    );
}
interface PickerProps {
    readonly moduleCode: NoteModule;
    readonly selected: NoteRelatedRecord[];
    readonly onChange: (items: NoteRelatedRecord[]) => void;
    readonly disabled: boolean;
}
/** La selección conserva las identidades que emitió el servidor. La persona solo ve etiquetas de negocio. */
export function NoteRelatedRecordsPicker(props: PickerProps) {
    return (
        <div className="note-related-records__picker">
            <p className="note-related-records__head">
                <span>Vincula un cliente y una orden</span>
                <FormHelp text="Busca un cliente/lead y una orden. Relacionarlos no comparte la nota ni concede acceso al registro. Hasta 20 registros; los vínculos restringidos existentes se conservan." />
            </p>
            <RecordSearch {...props} kind="lead" />
            <RecordSearch {...props} kind="sales_order" />
            {props.selected.length > 0 && (
                <ul className="note-related-records__selected">
                    {props.selected.map((item, index) => (
                        <li key={item.reference ? relatedRecordKey(item.reference) : index}>
                            <span>{recordCaption(item)}</span>
                            {item.primary && <small>Vínculo original</small>}
                            <RelatedLeadSuggestion item={item} {...props} />
                            {item.reference && !item.primary && (
                                <button
                                    type="button"
                                    disabled={props.disabled}
                                    onClick={() => {
                                        props.onChange(props.selected.filter((row) => row !== item));
                                    }}
                                    aria-label={`Quitar ${item.label ?? "registro"}`}
                                >
                                    Quitar
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
function RelatedLeadSuggestion({ item, selected, onChange, disabled }: PickerProps & { readonly item: NoteRelatedRecord }) {
    const lead = item.relatedLead;
    if (!lead || selected.some((record) => record.reference && relatedRecordKey(record.reference) === relatedRecordKey(lead.reference))) return null;
    return (
        <button
            type="button"
            disabled={disabled || selected.length >= 20}
            onClick={() => {
                onChange([...selected, { kind: "lead", reference: lead.reference, label: lead.label, description: lead.description, url: null, restricted: false }]);
            }}
        >
            Vincular también al cliente {lead.label}
        </button>
    );
}
function RecordSearch({ moduleCode, selected, onChange, disabled, kind }: PickerProps & { readonly kind: NoteRecordReference["kind"] }) {
    const selectId = useId();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [page, setPage] = useState(1);
    const [retry, setRetry] = useState(0);
    const [items, setItems] = useState<NoteRelatedRecord[]>([]);
    const [hasMore, setHasMore] = useState(false);
    const [partial, setPartial] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    useEffect(() => {
        let active = true;
        const timer = window.setTimeout(() => {
            setLoading(true);
            setError(false);
            void getRelatedRecordOptions(moduleCode, kind, query, page)
                .then(
                    (result) => {
                        if (!active) return;
                        setItems((old) => (page === 1 ? result.items : [...old, ...result.items]));
                        setHasMore(result.hasMore);
                        setPartial(result.partial);
                    },
                    () => {
                        if (active) {
                            setError(true);
                            setItems([]);
                        }
                    },
                )
                .finally(() => {
                    if (active) setLoading(false);
                });
        }, 250);
        return () => {
            active = false;
            window.clearTimeout(timer);
        };
    }, [moduleCode, kind, query, page, retry]);
    const chosen = new Set(selected.flatMap((item) => (item.reference ? [relatedRecordKey(item.reference)] : [])));
    const options = items.filter((item) => item.reference && !chosen.has(relatedRecordKey(item.reference)));
    return (
        <fieldset className="note-related-records__search" disabled={disabled}>
            <legend>
                <i aria-hidden="true">{kind === "lead" ? <UserOutlined /> : <FileTextOutlined />}</i>
                {kind === "lead" ? "Cliente/lead" : "Orden de venta"}
            </legend>
            <label className="note-sr" htmlFor={selectId}>
                {kind === "lead" ? "Buscar cliente/lead" : "Buscar orden de venta"}
            </label>
            <Select<string>
                id={selectId}
                aria-label={kind === "lead" ? "Buscar cliente/lead" : "Buscar orden de venta"}
                value={null}
                virtual={false}
                onOpenChange={setOpen}
                loading={loading}
                disabled={disabled || selected.length >= 20}
                getPopupContainer={(trigger: HTMLElement) => trigger.closest<HTMLElement>(".ant-drawer-body") ?? trigger.parentElement ?? trigger}
                showSearch={{
                    filterOption: false,
                    searchValue: query,
                    onSearch: (value) => {
                        setItems([]);
                        setLoading(true);
                        setQuery(value.slice(0, 100));
                        setPage(1);
                    },
                }}
                options={options.flatMap((item) => (item.reference ? [{ value: relatedRecordKey(item.reference), label: item.label ?? "Registro", description: item.description }] : []))}
                optionRender={(option) => (
                    <span>
                        {option.label}
                        {option.data.description && <small style={{ display: "block" }}>{option.data.description}</small>}
                    </span>
                )}
                popupRender={(menu) => (
                    <>
                        {menu}
                        {hasMore && (
                            <button
                                type="button"
                                disabled={loading}
                                onMouseDown={(event) => {
                                    event.preventDefault();
                                }}
                                onClick={() => {
                                    setPage((value) => value + 1);
                                }}
                            >
                                Cargar más {kind === "lead" ? "clientes" : "órdenes"}
                            </button>
                        )}
                    </>
                )}
                notFoundContent={loading ? "Buscando registros…" : "No hay registros disponibles para esta búsqueda"}
                placeholder={kind === "lead" ? "Nombre o dato del cliente" : "Número de orden"}
                onInputKeyDown={(event) => {
                    if (event.key === "Enter" && !open) event.preventDefault();
                }}
                onSelect={(value: string) => {
                    const item = options.find((row) => row.reference && relatedRecordKey(row.reference) === value);
                    if (item) onChange([...selected, item]);
                    setQuery("");
                    setPage(1);
                }}
            />
            <RecordSearchFeedback
                loading={loading}
                partial={partial}
                error={error}
                onRetry={() => {
                    setRetry((value) => value + 1);
                }}
            />
        </fieldset>
    );
}
/** Los vínculos existentes se pintan sin pedir tarjetas extra. Solo el autor abre el editor versionado. */
export function NoteRelatedRecordsSection({ noteId, moduleCode, records, canEdit, onChanged }: { readonly noteId: string; readonly moduleCode: NoteModule; readonly records: NoteRelatedRecord[]; readonly canEdit: boolean; readonly onChanged: () => void }) {
    const [expanded, setExpanded] = useState(false);
    return (
        <section className="note-related-records" aria-label="Registros relacionados de la nota">
            <h3>Registros relacionados</h3>
            <NoteRelatedRecordsSummary records={records} />
            {!records.length && <p>Sin cliente ni orden vinculados.</p>}
            {canEdit && (
                <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => {
                        setExpanded((value) => !value);
                    }}
                >
                    Gestionar registros relacionados
                </button>
            )}
            {canEdit && expanded && <RelatedRecordsEditor noteId={noteId} moduleCode={moduleCode} onChanged={onChanged} />}
        </section>
    );
}
function RelatedRecordsEditor({ noteId, moduleCode, onChanged }: { readonly noteId: string; readonly moduleCode: NoteModule; readonly onChanged: () => void }) {
    const [data, setData] = useState<NoteRelatedRecords | null>(null);
    const [selected, setSelected] = useState<NoteRelatedRecord[]>([]);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [reload, setReload] = useState(0);
    const [pending, setPending] = useState<RelatedRecordsCommand | null>(null);
    const [remoteChanges, setRemoteChanges] = useState(false);
    const dirty = useRef(false);
    const flight = useRef(false);
    useEffect(() => {
        let active = true;
        void getNoteRelatedRecords(noteId).then(
            (result) => {
                if (!active) return;
                setData(result);
                setSelected(result.items);
                setError("");
                setRemoteChanges(false);
            },
            () => {
                if (active) setError("No se pudieron cargar los vínculos. Reintenta.");
            },
        );
        return () => {
            active = false;
        };
    }, [noteId, reload]);
    useNotesRealtime("snapshot", (event) => {
        if (event?.noteId && event.noteId !== noteId) return;
        if (dirty.current || flight.current || pending) {
            setRemoteChanges(true);
            return;
        }
        setReload((value) => value + 1);
    });
    const execute = async (command: RelatedRecordsCommand) => {
        if (flight.current) return;
        flight.current = true;
        setBusy(true);
        setPending(command);
        setError("");
        try {
            await saveNoteRelatedRecords(noteId, command);
            dirty.current = false;
            setPending(null);
            setReload((value) => value + 1);
            onChanged();
        } catch (reason) {
            if (reason instanceof ApiClientError && reason.status < 500) {
                setPending(null);
                setData(null);
            }
            setError(reason instanceof ApiClientError && reason.status < 500 ? "No se pudieron guardar los vínculos. Recarga para revisar tu acceso o la versión." : "No se confirmó el guardado. Reintenta la misma operación.");
        } finally {
            flight.current = false;
            setBusy(false);
        }
    };
    return (
        <div className="note-related-records__editor">
            <RelatedEditorFeedback
                data={data}
                remoteChanges={remoteChanges}
                error={error}
                pending={pending}
                busy={busy}
                onRetry={() => {
                    if (pending) void execute(pending);
                }}
                onReload={() => {
                    dirty.current = false;
                    setReload((value) => value + 1);
                }}
            />
            {!data && !error && <p role="status">Cargando vínculos…</p>}
            {data && (
                <>
                    <NoteRelatedRecordsPicker
                        moduleCode={moduleCode}
                        selected={selected}
                        disabled={busy || pending !== null || !data.canManage}
                        onChange={(value) => {
                            dirty.current = true;
                            setSelected(value);
                        }}
                    />
                    <button
                        type="button"
                        disabled={busy || pending !== null || !data.canManage}
                        onClick={() => {
                            void execute({ operationId: crypto.randomUUID(), expectedCollaborationVersion: data.version, relatedRecords: references(selected) });
                        }}
                    >
                        Guardar registros relacionados
                    </button>
                </>
            )}
        </div>
    );
}

function RecordSearchFeedback({ loading, partial, error, onRetry }: { readonly loading: boolean; readonly partial: boolean; readonly error: boolean; readonly onRetry: () => void }) {
    return (
        <>
            {loading && <small role="status">Buscando registros…</small>}
            {partial && <small role="status">Resultados parciales: no se pudo consultar todo. Puedes reintentar.</small>}
            {error && (
                <div role="alert">
                    <p>No se pudieron consultar estos registros. Revisa tu acceso y reintenta.</p>
                    <button type="button" onClick={onRetry}>
                        Reintentar búsqueda
                    </button>
                </div>
            )}
        </>
    );
}
function RelatedEditorFeedback({ data, remoteChanges, error, pending, busy, onRetry, onReload }: { readonly data: NoteRelatedRecords | null; readonly remoteChanges: boolean; readonly error: string; readonly pending: RelatedRecordsCommand | null; readonly busy: boolean; readonly onRetry: () => void; readonly onReload: () => void }) {
    return (
        <>
            {data && !data.canManage && <p role="alert">Solo el autor con permiso de edición puede gestionar estos vínculos mientras la nota está pendiente.</p>}
            {remoteChanges && <p role="status">Hay cambios remotos. Tu selección se conserva; recarga para descartarla.</p>}
            {error && (
                <div role="alert">
                    <p>{error}</p>
                    {pending ? (
                        <button type="button" disabled={busy} onClick={onRetry}>
                            Reintentar el mismo guardado
                        </button>
                    ) : (
                        <button type="button" onClick={onReload}>
                            Recargar vínculos
                        </button>
                    )}
                </div>
            )}
        </>
    );
}
