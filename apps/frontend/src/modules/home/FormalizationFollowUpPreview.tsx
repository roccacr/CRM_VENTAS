import LeftOutlined from "@ant-design/icons/LeftOutlined";
import RightOutlined from "@ant-design/icons/RightOutlined";
import SearchOutlined from "@ant-design/icons/SearchOutlined";
import Button from "antd/es/button";
import Select from "antd/es/select";
import Tag from "antd/es/tag";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";

import { FormHelp } from "../../components/forms/FormHelp";
import { type FollowUp, type FollowUpItem, type FollowUpQueue, getFollowUp, getFormalizationOrderRecord } from "../../services/formalization/follow-up-service";
import { CatalogBanners } from "../administration/catalogs/CatalogSummary";
import { type FollowUpFilterRequest, type FollowUpSelection, isFollowUpSelection, useFollowUpFilters } from "./formalization-filter-preferences";
import { buildOrderCards } from "./formalization-order-cards";
import { type FormalizationExample, type PreviewQueue } from "./formalization-preview.model";
import { FORMALIZATION_FOLLOW_UP_HELP } from "./formalization-queue-help";
import { FormalizationOrderDrawer } from "./FormalizationOrderDrawer";
import { FormalizationOrderRecord } from "./FormalizationOrderPreview";
import { StageChip } from "./FormalizationStageChip";
import { canReadOrderAddendum } from "./order-addendum-permissions";

const labels: Record<FollowUpQueue, string> = { all: "Todas", approvals: "Pendientes de aprobación", addendum: "Pendientes de adéndum", contracts: "Contratos pendientes", send: "Por enviar", signature: "Pendientes de firma", bank: "Gestión bancaria", balance: "Pendientes de saldo", transfer: "Traspasos pendientes", signed: "Traspaso firmado", closed: "Formalizaciones cerradas este año" };
/** Spanish collation, so accents and "La Estefana : LE GAIA" vs "La Estefana: LE NOA" sort the way people read them. */
const byName = (a: string, b: string) => a.localeCompare(b, "es", { numeric: true, sensitivity: "base" });
/** "Todas" always opens the list; the rest follow alphabetically so a long list can be scanned. */
const sortedQueues = (queues: readonly FollowUpQueue[]): readonly FollowUpQueue[] => [...queues.filter((entry) => entry === "all"), ...queues.filter((entry) => entry !== "all").sort((a, b) => byName(labels[a], labels[b]))];
const columns = ["Orden / Cliente", "Proyecto / Unidad", "Etapa / Pendiente", "Responsable / Tiempo", "Siguiente paso"];
interface Props {
    readonly filterRequest?: FollowUpFilterRequest | undefined;
    readonly onNavigate?: ((path: string) => void) | undefined;
    readonly canReadOrder?: boolean;
    readonly allowedQueues?: readonly FollowUpQueue[];
    readonly onOpenRecord?: (item: FollowUpItem) => void;
    readonly onOpenOrder: (order: FormalizationExample) => void;
    readonly tableOnly: boolean;
    readonly filterStorageKey?: string | undefined;
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
    return <LiveFollowUp key={JSON.stringify([props.canViewApprovals, props.allowedQueues, props.canReadOrder, props.filterStorageKey, props.tableOnly, props.scope])} {...props} canViewApprovals={props.canViewApprovals ?? false} refreshVersion={props.refreshVersion ?? 0} />;
}

function useFollowUp({ scope, canViewApprovals, refreshVersion, allowedQueues, stagePermissions, filterStorageKey, tableOnly, filterRequest }: Props & { canViewApprovals: boolean; refreshVersion: number }) {
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const filters = useFollowUpFilters({ scope, tableOnly, canViewApprovals, filterStorageKey, allowedQueues, stagePermissions, filterRequest });
    const { projectIds, selectedSelections, selectedQueues, bankStages, queues } = filters;
    const [page, setPage] = useState(1);
    const [appliedRequest, setAppliedRequest] = useState<FollowUpFilterRequest>();
    if (filterRequest !== appliedRequest) {
        setAppliedRequest(filterRequest);
        setPage(1);
    }
    const [retry, setRetry] = useState(0);
    const [response, setResponse] = useState<{ key: string; value: FollowUp } | null>(null);
    const [projectCatalog, setProjectCatalog] = useState<FollowUp["projects"]>([]);
    const [failure, setFailure] = useState<string | null>(null);
    const pending = useRef<{ key: string; promise: Promise<FollowUp> } | null>(null);
    // Include raw search and permission changes in the fence, before the debounce finishes.
    const key = JSON.stringify([search, debouncedSearch, projectIds, selectedSelections, page, retry, refreshVersion, canViewApprovals]);
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
        if (pending.current?.key !== key) pending.current = { key, promise: getFollowUp({ search: debouncedSearch, projectId: "", queue: "all", projectIds, queues: selectedQueues, bankStages, page, pageSize: 25 }) };
        void pending.current.promise.then(
            (data) => {
                if (active) {
                    setResponse({ key, value: data });
                    setProjectCatalog(data.projects);
                }
            },
            () => {
                if (active) setFailure(key);
            },
        );
        return () => {
            active = false;
        };
    }, [search, debouncedSearch, key, projectIds, selectedQueues, bankStages, page]);
    const invalidate = () => {
        // Catalog options survive refresh; rows must be fenced even when revisiting a prior key.
        setResponse(null);
        setFailure(null);
    };
    return { ...filters, search, setSearch, page, setPage, setRetry, invalidate, value, failed, projects: projectCatalog, queues, canViewApprovals };
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
function FollowUpBody({ model, onOpen, showAddendum }: { readonly model: ReturnType<typeof useFollowUp>; readonly onOpen: ((id: string) => void) | undefined; readonly showAddendum: boolean }) {
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
    return value ? <FollowUpTable value={value} model={model} onOpen={onOpen} showAddendum={showAddendum} /> : <FollowUpSkeleton />;
}

function FollowUpHeading({ id, tableOnly, total }: { readonly id: string; readonly tableOnly: boolean; readonly total: number | undefined }) {
    return (
        <div className="formalization-surface__header">
            <div className="formalization-followup__heading">
                <div className="formalization-title-help">
                    <h2 id={id}>{tableOnly ? "Listado de órdenes" : "Pendientes de seguimiento"}</h2>
                    <FormHelp label={`Ayuda de ${tableOnly ? "Listado de órdenes" : "Pendientes de seguimiento"}`} text={FORMALIZATION_FOLLOW_UP_HELP} />
                </div>
                <p>{tableOnly ? "Busca o filtra por proyecto y bandeja, y abre una orden para ver su detalle." : "Consulta de órdenes por proyecto y bandeja."}</p>
            </div>
            {total !== undefined && <span className="formalization-total">{total} órdenes</span>}
        </div>
    );
}

/** The table and its canonical side panel share which order is open; stage updates use a separate permission. */
function FollowUpWorkspace({ canReadOrder, model, stagePermissions = [], canUpdateStage, onRefresh, onViewFull, onNavigate }: { readonly canReadOrder: boolean; readonly onViewFull: (item: FollowUpItem) => void; readonly onNavigate?: ((path: string) => void) | undefined; readonly model: ReturnType<typeof useFollowUp>; readonly stagePermissions?: readonly { code: string; effect: string }[] | undefined; readonly canUpdateStage: boolean | undefined; readonly onRefresh: (() => void) | undefined }) {
    const items = model.value?.items ?? [];
    const open = useOpenOrder(items);
    return (
        <>
            <FollowUpBody model={model} onOpen={canReadOrder ? open.setOpenId : undefined} showAddendum={canReadOrderAddendum(stagePermissions)} />
            <FormalizationOrderDrawer
                onNavigate={onNavigate}
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
                <FollowUpWorkspace canReadOrder={props.canReadOrder === true} stagePermissions={stagePermissions} onViewFull={props.onOpenRecord ?? setFullOrder} model={model} canUpdateStage={canUpdateStage} onRefresh={props.onRefresh} onNavigate={props.onNavigate} />
            </section>
        </>
    );
}

function FollowUpToolbar({ model, tableOnly }: { readonly model: ReturnType<typeof useFollowUp>; readonly tableOnly: boolean }) {
    const { search, setSearch, projectIds, setProjects, selectedSelections, setSelections, setPage, value, projects, queues, invalidate } = model;
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
            <div className="formalization-field formalization-field--multiple">
                <span>Proyectos</span>
                <Select<string[]>
                    mode="multiple"
                    variant="borderless"
                    virtual={false}
                    maxCount={50}
                    aria-label="Filtrar por proyecto"
                    value={projectIds}
                    allowClear
                    showSearch={{ optionFilterProp: "label" }}
                    maxTagCount="responsive"
                    placeholder="Todos los proyectos"
                    options={[...projects].sort((a, b) => byName(a.name, b.name)).map((project) => ({ value: project.id, label: project.name }))}
                    onChange={(values) => {
                        invalidate();
                        setProjects(values);
                        setPage(1);
                    }}
                />
            </div>
            <div className="formalization-field formalization-field--queue formalization-field--multiple">
                <span>Bandejas y subestados</span>
                <Select<FollowUpSelection[]>
                    mode="multiple"
                    variant="borderless"
                    virtual={false}
                    maxCount={14}
                    aria-label="Bandeja de seguimiento"
                    value={selectedSelections}
                    allowClear
                    showSearch={{ optionFilterProp: "label" }}
                    maxTagCount="responsive"
                    placeholder="Todas las bandejas permitidas"
                    options={[
                        ...sortedQueues(queues)
                            .filter((entry) => entry !== "all")
                            .map((entry) => ({ value: entry, label: `${labels[entry]} (${followUpQueueCount(value, entry)})` })),
                        ...(queues.includes("bank")
                            ? [
                                  { value: "bank_not_started", label: "Gestión bancaria · Sin iniciar (subestado)" },
                                  { value: "bank_in_progress", label: "Gestión bancaria · En proceso (subestado)" },
                              ]
                            : []),
                    ]}
                    onChange={(values) => {
                        invalidate();
                        setSelections(values.filter(isFollowUpSelection));
                        setPage(1);
                    }}
                />
            </div>
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

const addendumBadges: Readonly<Partial<Record<string, ReactNode>>> = { pending: <Tag color="gold">Adéndum pendiente</Tag>, sent: <Tag color="blue">Adéndum enviado</Tag> };
function FollowUpRow({ item, onOpen, showAddendum }: { readonly item: FollowUpItem; readonly onOpen: ((id: string) => void) | undefined; readonly showAddendum: boolean }) {
    const id = `${item.source}:${item.id}`;
    const rowAccess = onOpen ? { className: "formalization-grid__row formalization-grid__row--openable", tabIndex: 0, label: `Abrir detalle de la orden ${item.number}` } : { className: "formalization-grid__row", tabIndex: undefined, label: undefined };
    return (
        <tr
            className={rowAccess.className}
            tabIndex={rowAccess.tabIndex}
            aria-label={rowAccess.label}
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
                {showAddendum ? addendumBadges[item.addendumStatus ?? "none"] : null}
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
function FollowUpTable({ value, model, onOpen, showAddendum }: { readonly value: FollowUp; readonly model: ReturnType<typeof useFollowUp>; readonly onOpen: ((id: string) => void) | undefined; readonly showAddendum: boolean }) {
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
                            <FollowUpRow key={`${item.source}:${item.id}`} item={item} onOpen={onOpen} showAddendum={showAddendum} />
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

function followUpQueueCount(value: FollowUp | null, queue: FollowUpQueue): string {
    if (queue === "addendum" && value?.counts.addendum === undefined) return "—";
    return String(value?.counts[queue] ?? 0);
}
