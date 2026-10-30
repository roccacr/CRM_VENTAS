import LeftOutlined from "@ant-design/icons/LeftOutlined";
import RightOutlined from "@ant-design/icons/RightOutlined";
import SearchOutlined from "@ant-design/icons/SearchOutlined";
import Button from "antd/es/button";
import { useEffect, useId, useRef, useState } from "react";

import { FOLLOW_UP_QUEUES, type FollowUp, type FollowUpItem, type FollowUpQueue, getFollowUp, getFormalizationOrderRecord } from "../../services/formalization/follow-up-service";
import { CatalogBanners } from "../administration/catalogs/CatalogSummary";
import { buildOrderCards } from "./formalization-order-cards";
import { type FormalizationExample, type PreviewQueue } from "./formalization-preview.model";
import { FormalizationOrderDrawer } from "./FormalizationOrderDrawer";
import { FormalizationOrderRecord } from "./FormalizationOrderPreview";
import { StageChip } from "./FormalizationStageChip";

const labels: Record<FollowUpQueue, string> = { all: "Todas", approvals: "Pendientes de aprobación", contracts: "Contratos pendientes", send: "Por enviar", signature: "Pendientes de firma", bank: "Gestión bancaria", balance: "Pendientes de saldo", transfer: "Traspasos pendientes", signed: "Traspaso firmado", closed: "Formalizaciones cerradas este año" };
/** Spanish collation, so accents and "La Estefana : LE GAIA" vs "La Estefana: LE NOA" sort the way people read them. */
const byName = (a: string, b: string) => a.localeCompare(b, "es", { numeric: true, sensitivity: "base" });
/** "Todas" always opens the list; the rest follow alphabetically so a long list can be scanned. */
const sortedQueues = (queues: readonly FollowUpQueue[]): readonly FollowUpQueue[] => [...queues.filter((entry) => entry === "all"), ...queues.filter((entry) => entry !== "all").sort((a, b) => byName(labels[a], labels[b]))];
const columns = ["Orden / Cliente", "Proyecto / Unidad", "Etapa / Pendiente", "Responsable / Tiempo", "Siguiente paso"];
interface Props {
    readonly canReadOrder?: boolean;
    readonly allowedQueues?: readonly FollowUpQueue[];
    readonly onOpenRecord?: (item: FollowUpItem) => void;
    readonly onOpenOrder: (order: FormalizationExample) => void;
    readonly tableOnly: boolean;
    readonly scope: PreviewQueue;
    readonly canViewApprovals?: boolean;
    readonly enabled?: boolean;
    readonly refreshVersion?: number;
    readonly stagePermissions?: readonly { code: string; effect: string }[] | undefined;
    readonly canUpdateStage?: boolean;
    readonly onRefresh?: () => void;
}

/** Canonical rows never enter simulated order previews. Revocation unmounts the consumer. */
export function FormalizationFollowUpPreview(props: Props) {
    if (!props.enabled)
        return (
            <section className="formalization-surface formalization-followup">
                <h2>Pendientes de seguimiento</h2>
                <p>El seguimiento de órdenes aún no está disponible.</p>
            </section>
        );
    return <LiveFollowUp key={JSON.stringify([props.canViewApprovals, props.allowedQueues, props.canReadOrder])} {...props} canViewApprovals={props.canViewApprovals ?? false} refreshVersion={props.refreshVersion ?? 0} />;
}

function useFollowUp({ scope, canViewApprovals, refreshVersion, allowedQueues }: Props & { canViewApprovals: boolean; refreshVersion: number }) {
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [projectId, setProject] = useState(scope.project ?? "");
    const [selectedQueue, setQueue] = useState<FollowUpQueue>(scope.filter);
    const queues = allowedQueues ?? FOLLOW_UP_QUEUES.filter((entry) => canViewApprovals || entry !== "approvals");
    const queue = queues.includes(selectedQueue) ? selectedQueue : "all";
    const [page, setPage] = useState(1);
    const [retry, setRetry] = useState(0);
    const [response, setResponse] = useState<{ key: string; value: FollowUp } | null>(null);
    const [failure, setFailure] = useState<string | null>(null);
    const pending = useRef<{ key: string; promise: Promise<FollowUp> } | null>(null);
    // Include raw search and permission changes in the fence, before the debounce finishes.
    const key = JSON.stringify([search, debouncedSearch, projectId, queue, page, retry, refreshVersion, canViewApprovals]);
    const value = response?.key === key ? response.value : null;
    const failed = failure === key;
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
        }, 300);
        return () => {
            clearTimeout(timer);
        };
    }, [search]);
    useEffect(() => {
        if (search !== debouncedSearch) return;
        let active = true;
        // StrictMode effect replay shares only this mounted consumer's current request.
        if (pending.current?.key !== key) pending.current = { key, promise: getFollowUp({ search: debouncedSearch, projectId, queue, page, pageSize: 25 }) };
        void pending.current.promise.then(
            (data) => {
                if (active) setResponse({ key, value: data });
            },
            () => {
                if (active) setFailure(key);
            },
        );
        return () => {
            active = false;
        };
    }, [search, debouncedSearch, projectId, queue, page, key]);
    const invalidate = () => {
        setResponse(null);
        setFailure(null);
    };
    return { search, setSearch, projectId, setProject, queue, setQueue, page, setPage, setRetry, invalidate, value, failed, projects: value?.projects ?? [], queues, canViewApprovals };
}

/** Which order is open in the side panel, and how to step to its neighbours on the current page. */
function useOpenOrder(items: readonly FollowUpItem[]) {
    const [opened, setOpened] = useState<FollowUpItem | null>(null);
    const index = items.findIndex((item) => item.source === opened?.source && item.id === opened.id);
    const setOpenId = (id: string | null) => {
        setOpened(items.find((item) => `${item.source}:${item.id}` === id) ?? null);
    };
    const walk = (step: number) => {
        const next = items[index + step];
        if (next) setOpened(next);
    };
    // The selected record survives removal from a filtered queue; only this authorized read refreshes it.
    const refresh = async () => {
        if (!opened) return;
        const updated = await getFormalizationOrderRecord(opened.source, opened.id.replace(/^legacy:/, ""));
        setOpened((current) => (current?.source === opened.source && current.id === opened.id ? updated : current));
    };
    return { item: opened, position: index + 1, setOpenId, walk, refresh };
}

/** Loading, error or table: one place decides, so the section stays simple. */
function FollowUpBody({ model, onOpen }: { readonly model: ReturnType<typeof useFollowUp>; readonly onOpen: ((id: string) => void) | undefined }) {
    const { value, failed, setRetry } = model;
    if (failed)
        return (
            <div role="alert" className="formalization-followup__message">
                <span>No se pudo cargar el seguimiento.</span>
                <Button
                    onClick={() => {
                        setRetry((version) => version + 1);
                    }}
                >
                    Reintentar seguimiento
                </Button>
            </div>
        );
    return value ? <FollowUpTable value={value} model={model} onOpen={onOpen} /> : <FollowUpSkeleton />;
}

function FollowUpHeading({ id, tableOnly, total }: { readonly id: string; readonly tableOnly: boolean; readonly total: number | undefined }) {
    return (
        <div className="formalization-surface__header">
            <div className="formalization-followup__heading">
                <h2 id={id}>{tableOnly ? "Listado de órdenes" : "Pendientes de seguimiento"}</h2>
                <p>{tableOnly ? "Busca o filtra por proyecto y bandeja, y abre una orden para ver su detalle." : "Consulta de órdenes por proyecto y bandeja."}</p>
            </div>
            {total !== undefined && <span className="formalization-total">{total} órdenes</span>}
        </div>
    );
}

/** The table and its canonical side panel share which order is open; stage updates use a separate permission. */
function FollowUpWorkspace({ canReadOrder, model, stagePermissions = [], canUpdateStage, onRefresh, onViewFull }: { readonly canReadOrder: boolean; readonly onViewFull: (item: FollowUpItem) => void; readonly model: ReturnType<typeof useFollowUp>; readonly stagePermissions?: readonly { code: string; effect: string }[] | undefined; readonly canUpdateStage: boolean | undefined; readonly onRefresh: (() => void) | undefined }) {
    const items = model.value?.items ?? [];
    const open = useOpenOrder(items);
    return (
        <>
            <FollowUpBody model={model} onOpen={canReadOrder ? open.setOpenId : undefined} />
            <FormalizationOrderDrawer
                onViewFull={() => {
                    if (open.item) onViewFull(open.item);
                    open.setOpenId(null);
                }}
                stagePermissions={stagePermissions}
                canUpdateStage={canUpdateStage === true}
                onStageSaved={async () => {
                    await open.refresh();
                    refreshFollowUp(model, onRefresh);
                }}
                onRefreshOrder={() => {
                    refreshFollowUp(model, onRefresh);
                }}
                item={canReadOrder ? open.item : null}
                position={open.position}
                total={items.length}
                onClose={() => {
                    open.setOpenId(null);
                }}
                onSelectPrevious={() => {
                    open.walk(-1);
                }}
                onSelectNext={() => {
                    open.walk(1);
                }}
            />
        </>
    );
}

function LiveFollowUp({ canUpdateStage, canViewApprovals, refreshVersion, ...props }: Props & { canViewApprovals: boolean; refreshVersion: number }) {
    const title = useId();
    const [fullOrder, setFullOrder] = useState<FollowUpItem | null>(null);
    const model = useFollowUp({ ...props, canViewApprovals, refreshVersion });
    const { value, failed } = model;
    const { tableOnly, stagePermissions } = props;
    if (fullOrder)
        return (
            <FormalizationOrderRecord
                item={fullOrder}
                onBack={() => {
                    setFullOrder(null);
                }}
            />
        );
    return (
        <>
            {tableOnly && (
                <div className="catalog-items-page--projects formalization-order-banners">
                    <CatalogBanners label="Resumen de órdenes" cards={buildOrderCards(value?.counts ?? null, model.queues)} />
                </div>
            )}
            <section className="formalization-surface formalization-followup" aria-labelledby={title} aria-busy={!value && !failed}>
                <FollowUpHeading id={title} tableOnly={tableOnly} total={value?.page.total} />
                <FollowUpToolbar model={model} tableOnly={tableOnly} />
                <FollowUpWorkspace canReadOrder={props.canReadOrder === true} stagePermissions={stagePermissions} onViewFull={props.onOpenRecord ?? setFullOrder} model={model} canUpdateStage={canUpdateStage} onRefresh={props.onRefresh} />
            </section>
        </>
    );
}

function FollowUpToolbar({ model, tableOnly }: { readonly model: ReturnType<typeof useFollowUp>; readonly tableOnly: boolean }) {
    const { search, setSearch, projectId, setProject, queue, setQueue, setPage, value, projects, queues, invalidate } = model;
    return (
        <div className="formalization-toolbar" data-home={!tableOnly}>
            <label className="formalization-search">
                <SearchOutlined aria-hidden="true" />
                <input
                    type="search"
                    aria-label="Buscar operación"
                    placeholder="Orden, cliente, unidad o responsable"
                    value={search}
                    onChange={(event) => {
                        invalidate();
                        setSearch(event.target.value);
                        setPage(1);
                    }}
                />
            </label>
            <label className="formalization-field">
                <span>Proyecto</span>
                <select
                    aria-label="Filtrar por proyecto"
                    value={projectId}
                    onChange={(event) => {
                        invalidate();
                        setProject(event.target.value);
                        setPage(1);
                    }}
                >
                    <option value="">Todos los proyectos</option>
                    {[...projects]
                        .sort((a, b) => byName(a.name, b.name))
                        .map((project) => (
                            <option key={project.id} value={project.id}>
                                {project.name}
                            </option>
                        ))}
                </select>
            </label>
            <label className="formalization-field formalization-field--queue">
                <span>Bandeja</span>
                <select
                    aria-label="Bandeja de seguimiento"
                    value={queue}
                    onChange={(event) => {
                        invalidate();
                        setQueue(FOLLOW_UP_QUEUES.find((entry) => entry === event.target.value) ?? "all");
                        setPage(1);
                    }}
                >
                    {sortedQueues(queues).map((entry) => (
                        <option key={entry} value={entry}>
                            {labels[entry]}
                            {value ? ` (${String(value.counts[entry])})` : ""}
                        </option>
                    ))}
                </select>
            </label>
        </div>
    );
}
/** Missing time is a dash on screen and full words for assistive technology, so a column of identical "not available" lines does not shout. */
function TimeInStage({ days }: { readonly days: number | null }) {
    if (days !== null) return <span className="formalization-grid__meta">{`${String(days)} días en etapa`}</span>;
    return (
        <span className="formalization-grid__meta formalization-grid__meta--quiet">
            <span aria-hidden="true">—</span>
            <span className="formalization-sr">Tiempo no disponible</span>
        </span>
    );
}

const SKELETON_ROWS = 6;

/**
 * Loading state with the table's own header and row rhythm, so the page does not jump when the data arrives.
 * Static bars on purpose: animated shimmer repaints continuously and is costly on old laptops.
 */
function FollowUpSkeleton() {
    return (
        <div role="status" className="formalization-grid-scroll">
            <span className="formalization-sr">Cargando seguimiento…</span>
            <table className="formalization-grid formalization-grid--orders" aria-hidden="true">
                <thead>
                    <tr>
                        {columns.map((label) => (
                            <th key={label}>{label}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {Array.from({ length: SKELETON_ROWS }, (_, row) => (
                        <tr key={row} className="formalization-grid__row">
                            {columns.map((label) => (
                                <td key={label}>
                                    <span className="formalization-skeleton formalization-skeleton--strong" />
                                    <span className="formalization-skeleton" />
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function isStageAuthorResponsible(owner: FollowUpItem["responsible"], author: FollowUpItem["changedBy"]): boolean {
    if (!owner || !author || owner.id !== author.id) return false;
    // Null IDs cannot establish identity; compare their recorded names only when both IDs are null.
    return owner.id !== null || owner.name === author.name;
}

/** Renders stage ownership independently from sales attribution and change authorship. */
function StageResponsibility({ item }: { readonly item: FollowUpItem }) {
    const owner = item.responsible;
    const author = item.changedBy;
    const samePerson = isStageAuthorResponsible(owner, author);
    return (
        <>
            <span className="formalization-grid__value">{owner?.name ?? "Sin responsable registrado"}</span>
            {item.seller && <span className="formalization-grid__meta">Vendedor: {item.seller.name}</span>}
            {author && !samePerson && <span className="formalization-grid__meta">Autor del cambio: {author.name}</span>}
        </>
    );
}

function FollowUpRow({ item, onOpen }: { readonly item: FollowUpItem; readonly onOpen: ((id: string) => void) | undefined }) {
    const id = `${item.source}:${item.id}`;
    return (
        <tr
            className={`formalization-grid__row${onOpen ? " formalization-grid__row--openable" : ""}`}
            tabIndex={onOpen ? 0 : undefined}
            aria-label={onOpen ? `Abrir detalle de la orden ${item.number}` : undefined}
            onClick={() => {
                onOpen?.(id);
            }}
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpen?.(id);
                }
            }}
        >
            <td>
                <strong className="formalization-grid__primary">{item.number}</strong>
                <span className="formalization-grid__meta">{item.client ?? "Sin cliente"}</span>
            </td>
            <td data-label={columns[1]}>
                <span className="formalization-grid__value">{item.project?.name ?? "Sin proyecto"}</span>
                <span className="formalization-grid__meta">{item.unit ?? "Sin unidad"}</span>
            </td>
            <td data-label={columns[2]}>
                <StageChip label={item.state.label} />
            </td>
            <td data-label={columns[3]}>
                <StageResponsibility item={item} />
                <TimeInStage days={item.state.days} />
            </td>
            <td data-label={columns[4]}>
                <span>{item.nextStep}</span>
            </td>
        </tr>
    );
}
function FollowUpTable({ value, model, onOpen }: { readonly value: FollowUp; readonly model: ReturnType<typeof useFollowUp>; readonly onOpen: ((id: string) => void) | undefined }) {
    const { page, setPage, invalidate } = model;
    return (
        <>
            <div role="region" aria-label="Órdenes filtradas" className="formalization-grid-scroll" tabIndex={onOpen ? 0 : undefined}>
                <table className="formalization-grid formalization-grid--orders">
                    <caption className="formalization-sr">Operaciones pendientes de seguimiento</caption>
                    <thead>
                        <tr>
                            {columns.map((label) => (
                                <th key={label} scope="col">
                                    {label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {value.items.map((item) => (
                            <FollowUpRow key={`${item.source}:${item.id}`} item={item} onOpen={onOpen} />
                        ))}
                        {value.items.length === 0 && (
                            <tr>
                                <td colSpan={5} className="formalization-grid__empty">
                                    No hay órdenes para estos filtros.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <div className="formalization-surface__footer">
                <span>
                    Mostrando {value.items.length} de {value.page.total} operaciones · Página {value.page.number} de {value.page.totalPages}
                </span>
                <span className="formalization-pager">
                    <Button
                        aria-label="Página anterior"
                        icon={<LeftOutlined aria-hidden="true" />}
                        disabled={page <= 1}
                        onClick={() => {
                            invalidate();
                            setPage((number) => number - 1);
                        }}
                    />
                    <Button
                        aria-label="Página siguiente"
                        icon={<RightOutlined aria-hidden="true" />}
                        disabled={page >= value.page.totalPages}
                        onClick={() => {
                            invalidate();
                            setPage((number) => number + 1);
                        }}
                    />
                </span>
            </div>
        </>
    );
}

function refreshFollowUp(model: ReturnType<typeof useFollowUp>, onRefresh: (() => void) | undefined) {
    model.invalidate();
    model.setRetry((version) => version + 1);
    onRefresh?.();
}
