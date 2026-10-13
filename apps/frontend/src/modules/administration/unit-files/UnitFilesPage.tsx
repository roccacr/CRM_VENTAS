import "./UnitFilesPage.css";
import "../catalogs/ProjectsView.css";

import ChevronLeft from "@ant-design/icons/LeftOutlined";
import RefreshCw from "@ant-design/icons/ReloadOutlined";
import ChevronRight from "@ant-design/icons/RightOutlined";
import Search from "@ant-design/icons/SearchOutlined";
import Columns3 from "@ant-design/icons/TableOutlined";
import Button from "antd/es/button";
import ConfigProvider from "antd/es/config-provider";
import Drawer from "antd/es/drawer";
import Input from "antd/es/input";
import Modal from "antd/es/modal";
import Select from "antd/es/select";
import { useEffect, useRef, useState } from "react";

import type { CatalogContextModuleCode } from "../../../services/catalogs/catalog-service";
import { ADMINISTRATION_DRAWER_CLOSE_PLACEMENT, ADMINISTRATION_DRAWER_PROPS, ADMINISTRATION_MODAL_Z_INDEX } from "../administration-theme";
import { PROJECTS_THEME } from "../catalogs/projects-theme";
import { getUnitFile, listUnitFiles, listUnitProjects, type UnitDetail, type UnitFilter, type UnitPage, type UnitProject, type UnitSummary } from "./unit-files.api";
import { loadUnitFilePaneChoices, localUnitPaneData, type UnitPaneChoices, type UnitPaneSelection } from "./unit-files-search-panes";
import { UnitFilesComparison } from "./UnitFilesComparison";
import { UnitFilesDataTable } from "./UnitFilesDataTable";

const FIELD_LABELS: Record<string, string> = {
    code: "Unidad",
    projectNameSnapshot: "Proyecto de origen",
    housingType: "Tipo de vivienda",
    lotArea: "Lote (m²)",
    sourceStatus: "Estado de origen",
    advertisedSalePrice: "Precio anunciado",
    habitableArea: "Área habitable",
    totalArea: "Área total",
    approximateMaintenanceFee: "Cuota de mantenimiento",
    unitPlans: "Planos",
    estimatedDelivery: "Entrega estimada",
    storageArea: "Bodega",
    mezzanineArea: "Mezzanine",
    balconyArea: "Balcón",
    groundFloorArea: "Planta baja",
    upperFloorArea: "Planta alta",
    extensionArea: "Ampliación",
    terraceArea: "Terraza",
    pricePerSquareMeter: "Precio por m²",
    thirdLevelBasementArea: "Tercer nivel / sótano",
    approximateParkingArea: "Parqueo aproximado",
    externalGardenArea: "Jardín externo",
    slopedGardenArea: "Jardín con talud",
    openCommonArea: "Área común libre",
    minimumSalePrice: "Precio mínimo",
    modifiedAt: "Modificación de origen",
    cronValue: "Valor de sincronización",
};
const STATUSES = ["0. No Disponible", "1. Disponible para Venta", "2. Pre-Reservada", "3. Reservado", "4. Vendida", "5. Entregada", "6. Traspasada"];
const DETAIL_GROUPS = [
    { title: "Información del expediente", fields: ["code", "projectNameSnapshot", "housingType", "sourceStatus", "estimatedDelivery"] },
    { title: "Precios y mantenimiento", fields: ["advertisedSalePrice", "minimumSalePrice", "pricePerSquareMeter", "approximateMaintenanceFee"] },
    { title: "Áreas y distribución", fields: ["habitableArea", "totalArea", "lotArea", "approximateParkingArea", "storageArea", "mezzanineArea", "balconyArea", "groundFloorArea", "upperFloorArea", "extensionArea", "terraceArea", "thirdLevelBasementArea", "externalGardenArea", "slopedGardenArea", "openCommonArea"] },
    { title: "Documentación y sincronización", fields: ["unitPlans", "modifiedAt", "cronValue"] },
];
const CACHE_TTL = 30_000;
type Cached<T> = { at: number; value: T };
const show = (value: string | null | undefined) => value || "Sin asignar";

function fresh<T>(cache: Map<string, Cached<T>>, key: string): T | undefined {
    const entry = cache.get(key);
    return entry && Date.now() - entry.at < CACHE_TTL ? entry.value : undefined;
}
function remember<T>(cache: Map<string, Cached<T>>, key: string, value: T, maximum: number): void {
    const oldest = cache.keys().next().value;
    if (cache.size >= maximum && oldest !== undefined) cache.delete(oldest);
    cache.set(key, { at: Date.now(), value });
}

/** Criteria-first, bounded read view; caches are instance-local and expire to limit external drift. */
export function UnitFilesPage({ contextModuleCode = "administration", contextLabel = "Administración" }: { readonly contextModuleCode?: CatalogContextModuleCode; readonly contextLabel?: string }) {
    return (
        <ConfigProvider theme={PROJECTS_THEME}>
            <UnitFilesContent key={contextModuleCode} contextModuleCode={contextModuleCode} contextLabel={contextLabel} />
        </ConfigProvider>
    );
}

// Conditional JSX reflects independent loading/empty/detail states, not a branching domain algorithm.
// eslint-disable-next-line complexity
function UnitFilesContent({ contextModuleCode, contextLabel }: { readonly contextModuleCode: CatalogContextModuleCode; readonly contextLabel: string }) {
    const [projects, setProjects] = useState<UnitProject[]>([]);
    const [projectIds, setProjectIds] = useState<string[]>([]);
    const [status, setStatus] = useState<string>();
    const [codeMatch, setCodeMatch] = useState("");
    const [limit, setLimit] = useState(50);
    const [active, setActive] = useState<UnitFilter>();
    const [searchScope, setSearchScope] = useState<UnitFilter>();
    const [paneChoices, setPaneChoices] = useState<UnitPaneChoices>();
    const [page, setPage] = useState<UnitPage>();
    const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
    const [index, setIndex] = useState(0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [selected, setSelected] = useState<UnitSummary[]>([]);
    const [detailId, setDetailId] = useState<string>();
    const [detail, setDetail] = useState<UnitDetail>();
    const [detailError, setDetailError] = useState("");
    const [comparison, setComparison] = useState<UnitDetail[]>([]);
    const [comparing, setComparing] = useState(false);
    const [compareBusy, setCompareBusy] = useState(false);
    const [compareError, setCompareError] = useState("");
    const pages = useRef(new Map<string, Cached<UnitPage>>());
    const facets = useRef(new Map<string, Cached<UnitPaneChoices>>());
    const baseChoices = useRef<UnitPaneChoices | undefined>(undefined);
    const inventory = useRef(new Map<string, UnitSummary>());
    const details = useRef(new Map<string, Cached<UnitDetail>>());
    const sequence = useRef(0);
    const detailSequence = useRef(0);
    const comparisonSequence = useRef(0);

    useEffect(() => {
        let live = true;
        listUnitProjects(contextModuleCode)
            .then((items) => {
                if (live) setProjects(items);
            })
            .catch(() => {
                if (live) setError("No pudimos cargar los proyectos. Intenta nuevamente.");
            });
        return () => {
            live = false;
        };
    }, [contextModuleCode]);

    // Cache, request ownership and independent metadata loading are separate UI states.
    // eslint-disable-next-line complexity, sonarjs/cognitive-complexity
    async function load(filter: UnitFilter, nextIndex: number, history: (string | undefined)[], { refresh = false, loadChoices = false } = {}) {
        const request = ++sequence.current;
        const key = JSON.stringify([contextModuleCode, filter]);
        if (refresh) {
            pages.current.clear();
            facets.current.clear();
            details.current.clear();
            inventory.current.clear();
        }
        const cached = fresh(pages.current, key);
        const facetKey = JSON.stringify({ ...filter, cursor: undefined, limit: undefined });
        const cachedFacets = fresh(facets.current, facetKey);
        setError("");
        if (cached && (!loadChoices || cachedFacets)) {
            setPage(cached);
            setActive(filter);
            setIndex(nextIndex);
            setCursors(history);
            setBusy(false);
            if (cachedFacets) setPaneChoices(cachedFacets);
            return { items: cached.items, choices: cachedFacets ?? paneChoices };
        }
        setBusy(true);
        try {
            let choiceRequest: Promise<UnitPaneChoices | undefined> = Promise.resolve(undefined);
            if (loadChoices)
                choiceRequest = (async () => {
                    if (refresh) {
                        const base = await loadUnitFilePaneChoices(searchScope ?? filter, contextModuleCode, projects);
                        if (request !== sequence.current) return undefined;
                        baseChoices.current = base;
                    }
                    return cachedFacets ?? loadUnitFilePaneChoices(filter, contextModuleCode, projects, baseChoices.current);
                })();
            const [result, choices] = await Promise.all([cached ? Promise.resolve(cached) : listUnitFiles(filter, contextModuleCode), choiceRequest]);
            if (request !== sequence.current) return;
            for (const item of result.items) inventory.current.set(item.id, item);
            while (inventory.current.size > 2000) {
                const oldest = inventory.current.keys().next().value;
                if (oldest !== undefined) inventory.current.delete(oldest);
            }
            if (choices) {
                baseChoices.current ??= choices;
                remember(facets.current, facetKey, choices, 20);
                setPaneChoices(choices);
            }
            remember(pages.current, key, result, 20);
            setPage(result);
            setActive(filter);
            setIndex(nextIndex);
            setCursors(history);
            return { items: result.items, choices: choices ?? paneChoices };
        } catch {
            if (request === sequence.current) setError("No pudimos cargar los expedientes. La fuente temporal puede no estar disponible.");
        } finally {
            if (request === sequence.current) setBusy(false);
        }
    }
    async function readDetail(id: string) {
        const cached = fresh(details.current, id);
        if (cached) return cached;
        const result = await getUnitFile(id, contextModuleCode);
        remember(details.current, id, result, 24);
        return result;
    }
    async function openDetail(id: string) {
        const request = ++detailSequence.current;
        setDetailId(id);
        setDetail(undefined);
        setDetailError("");
        try {
            const result = await readDetail(id);
            if (request === detailSequence.current) setDetail(result);
        } catch {
            if (request === detailSequence.current) setDetailError("No pudimos cargar el detalle del expediente.");
        }
    }
    async function compare() {
        const request = ++comparisonSequence.current;
        setComparing(true);
        setCompareBusy(true);
        setCompareError("");
        setComparison([]);
        try {
            const result = await Promise.all(selected.map((item) => readDetail(item.id)));
            if (request === comparisonSequence.current) setComparison(result);
        } catch {
            if (request === comparisonSequence.current) setCompareError("No pudimos cargar todos los expedientes para comparar.");
        } finally {
            if (request === comparisonSequence.current) setCompareBusy(false);
        }
    }
    function toggle(item: UnitSummary, checked: boolean) {
        setSelected((previous) => (checked ? [...previous, item].slice(0, 8) : previous.filter((entry) => entry.id !== item.id)));
    }
    const search = () => {
        const filter = { projectIds: projectIds.length ? projectIds : projects.map((project) => project.id), limit, ...(status ? { status } : {}), ...(codeMatch.trim() ? { codeMatch: codeMatch.trim() } : {}) };
        const changed = JSON.stringify(filter) !== JSON.stringify(searchScope);
        if (changed) {
            setPaneChoices(undefined);
            baseChoices.current = undefined;
            facets.current.clear();
            inventory.current.clear();
        }
        setSearchScope(filter);
        void load(!changed && active ? { ...active, cursor: undefined } : filter, 0, [undefined], { loadChoices: changed || !paneChoices });
    };
    async function refinePane(selection: UnitPaneSelection) {
        if (!searchScope) return;
        const next: UnitFilter = { ...searchScope, limit, cursor: undefined };
        for (const [pane, field] of [
            ["projectIds", "paneProjectIds"],
            ["code", "codes"],
            ["housingType", "housingTypes"],
            ["status", "statuses"],
        ] as const) {
            if (selection[pane].length) next[field] = selection[pane];
        }
        const local = localUnitPaneData([...inventory.current.values()], baseChoices.current, selection);
        // Preserve server cursor boundaries for larger sets; never filter only the visible page.
        if (local && local.items.length <= next.limit) {
            sequence.current++;
            const result: UnitPage = { items: local.items, pagination: { limit: next.limit, returned: local.items.length, hasNext: false, nextCursor: null } };
            setPage(result);
            setPaneChoices(local.choices);
            setActive(next);
            setIndex(0);
            setCursors([undefined]);
            setError("");
            setBusy(false);
            return local;
        }
        const request = sequence.current + 1;
        const result = await load(next, 0, [undefined], { loadChoices: true });
        if (!result && request === sequence.current) {
            // Do not leave old inventory under newly selected criteria after a failed request.
            setPage(undefined);
            setActive(undefined);
            setPaneChoices(undefined);
            baseChoices.current = undefined;
        }
        return result;
    }
    return (
        <section className="unit-files-view catalog-items-page--projects">
            <header className="unit-files-heading">
                <div>
                    <div className="unit-files-breadcrumb">{contextLabel} / Catálogos / Expedientes de unidades</div>
                    <h1>Expedientes de unidades</h1>
                    <p>Consulta de unidades y referencias externas.</p>
                </div>
                <Button aria-label="Actualizar expedientes" title="Actualizar expedientes" disabled={!active || busy} icon={<RefreshCw size={16} />} onClick={() => active && void load({ ...active, cursor: undefined }, 0, [undefined], { refresh: true, loadChoices: true })} />
            </header>
            <form
                className="unit-files-filters"
                onSubmit={(event) => {
                    event.preventDefault();
                    if (projects.length && (projectIds.length || status || codeMatch.trim()) && !busy) search();
                }}
            >
                <label className="unit-files-projects">
                    Proyectos
                    <Select
                        aria-label="Proyectos"
                        mode="multiple"
                        value={projectIds}
                        onChange={(ids) => {
                            setProjectIds(ids);
                        }}
                        options={projects.map((project) => ({ value: project.id, label: project.name }))}
                        showSearch={{ optionFilterProp: "label" }}
                        placeholder="Seleccionar proyectos"
                    />
                </label>
                <label>
                    Estado
                    <Select
                        aria-label="Estado"
                        allowClear
                        value={status}
                        onChange={(next) => {
                            setStatus(next);
                        }}
                        options={STATUSES.map((value) => ({ value, label: value }))}
                        placeholder="Todos"
                    />
                </label>
                <label>
                    Código de expediente
                    <Input
                        aria-label="Código de expediente"
                        value={codeMatch}
                        maxLength={100}
                        allowClear
                        placeholder="Código o coincidencia"
                        onChange={(event) => {
                            setCodeMatch(event.target.value);
                        }}
                    />
                </label>
                <Button aria-label="Buscar expedientes" htmlType="submit" type="primary" disabled={!projects.length || (!projectIds.length && !status && !codeMatch.trim()) || busy} icon={<Search aria-hidden />}>
                    Buscar expedientes
                </Button>
            </form>
            {error && (
                <div className="unit-files-error" role="alert">
                    {error}
                </div>
            )}
            <div className="unit-files-canvas" aria-busy={busy}>
                {page && paneChoices && searchScope ? (
                    <UnitFilesDataTable
                        key={JSON.stringify(searchScope)}
                        items={page.items}
                        choices={paneChoices}
                        busy={busy}
                        onFilterChange={refinePane}
                        selected={selected}
                        onToggle={toggle}
                        onOpen={(id) => void openDetail(id)}
                        selectionBar={
                            selected.length > 0 && (
                                <div className="unit-files-selection">
                                    <span>{selected.length} / 8 seleccionados</span>
                                    <Button icon={<Columns3 size={16} />} disabled={selected.length < 2} onClick={() => void compare()}>
                                        Comparar
                                    </Button>
                                    <Button
                                        onClick={() => {
                                            setSelected([]);
                                        }}
                                    >
                                        Limpiar selección
                                    </Button>
                                </div>
                            )
                        }
                    />
                ) : (
                    <div className="unit-files-empty">Sin búsqueda</div>
                )}
                {busy && (
                    <div className="unit-files-loading" role="status">
                        <span className="unit-files-spinner" />
                        <strong>Cargando expedientes...</strong>
                        <span>Sincronizando información y referencias externas</span>
                    </div>
                )}
            </div>
            <footer className="unit-files-pagination">
                <span>{page ? `${String(page.pagination.returned)} expedientes · Página ${String(index + 1)}` : "0 expedientes"}</span>
                <div>
                    <Select
                        aria-label="Filas por página"
                        value={limit}
                        disabled={busy}
                        onChange={(value) => {
                            setLimit(value);
                            if (active) void load({ ...active, limit: value, cursor: undefined }, 0, [undefined]);
                        }}
                        options={[10, 50, 100].map((value) => ({ value, label: String(value) }))}
                    />
                    <Button aria-label="Página anterior" icon={<ChevronLeft size={16} />} disabled={index === 0 || busy} onClick={() => active && void load({ ...active, cursor: cursors[index - 1] }, index - 1, cursors)} />
                    <Button
                        aria-label="Página siguiente"
                        icon={<ChevronRight size={16} />}
                        disabled={!page?.pagination.hasNext || busy}
                        onClick={() => {
                            if (active && page?.pagination.nextCursor) {
                                const history = [...cursors.slice(0, index + 1), page.pagination.nextCursor];
                                void load({ ...active, cursor: page.pagination.nextCursor }, index + 1, history);
                            }
                        }}
                    />
                </div>
            </footer>
            <Drawer
                {...ADMINISTRATION_DRAWER_PROPS}
                closable={{ "aria-label": "Cerrar detalle", placement: ADMINISTRATION_DRAWER_CLOSE_PLACEMENT }}
                styles={{ ...ADMINISTRATION_DRAWER_PROPS.styles, wrapper: { ...ADMINISTRATION_DRAWER_PROPS.styles.wrapper, maxWidth: "100vw" }, body: { minHeight: 0, overflowY: "auto", overscrollBehavior: "contain" } }}
                rootClassName="unit-files-panel catalog-item-detail-drawer--projects"
                title={detail?.code || "Expediente de unidad"}
                open={Boolean(detailId)}
                onClose={() => {
                    detailSequence.current++;
                    setDetailId(undefined);
                }}
            >
                {detailError && <p role="alert">{detailError}</p>}
                {!detail && !detailError && (
                    <div className="unit-files-empty" role="status">
                        <span className="unit-files-spinner" />
                    </div>
                )}
                {detail && (
                    <>
                        <div className="unit-files-detail-identity">
                            <h2>{detail.project.name}</h2>
                            <span className="unit-files-status" data-status={detail.status}>
                                {show(detail.sourceStatus)}
                            </span>
                        </div>
                        {DETAIL_GROUPS.map((group) => (
                            <section className="unit-files-detail-section" key={group.title}>
                                <h3>{group.title}</h3>
                                <dl className="unit-files-values">
                                    {group.fields.map((key) => (
                                        <div key={key}>
                                            <dt>{FIELD_LABELS[key] ?? key}</dt>
                                            <dd>
                                                {key === "unitPlans" && /^https?:\/\//i.test(detail.values[key] ?? "") && URL.canParse(detail.values[key] ?? "") ? (
                                                    <a href={detail.values[key] ?? ""} target="_blank" rel="noopener noreferrer">
                                                        {detail.values[key]}
                                                    </a>
                                                ) : (
                                                    show(detail.values[key])
                                                )}
                                            </dd>
                                        </div>
                                    ))}
                                </dl>
                            </section>
                        ))}
                        <section className="unit-files-detail-section">
                            <h3>Registro</h3>
                            <dl className="unit-files-values">
                                <div>
                                    <dt>ID CRM</dt>
                                    <dd>{detail.nativeCode ? detail.id : "Pendiente de migración"}</dd>
                                </div>
                                <div>
                                    <dt>Código nativo</dt>
                                    <dd>{detail.nativeCode || "Pendiente de migración"}</dd>
                                </div>
                                <div>
                                    <dt>ID del proyecto CRM</dt>
                                    <dd>{detail.project.id}</dd>
                                </div>
                                <div>
                                    <dt>ID de origen</dt>
                                    <dd>{detail.legacyId ?? "Sin asignar"}</dd>
                                </div>
                                <div>
                                    <dt>Referencia de proyecto de origen</dt>
                                    <dd>{show(detail.sourceMetadata.projectReference)}</dd>
                                </div>
                                <div>
                                    <dt>Última actualización</dt>
                                    <dd>{show(detail.updatedAt)}</dd>
                                </div>
                            </dl>
                        </section>
                        {detail.externalReferences.map((reference) => (
                            <section className="unit-files-detail-section" key={`${reference.systemCode}:${reference.externalId}`}>
                                <h3>
                                    {reference.systemCode}
                                    <span className="unit-files-status" data-status={reference.status}>
                                        {reference.status === "active" ? "Activo" : reference.status === "inactive" ? "Inactivo" : reference.status}
                                    </span>
                                </h3>
                                <dl className="unit-files-values">
                                    <div>
                                        <dt>Código del sistema</dt>
                                        <dd>{reference.systemCode}</dd>
                                    </div>
                                    <div>
                                        <dt>Identificador</dt>
                                        <dd>{reference.externalId}</dd>
                                    </div>
                                </dl>
                            </section>
                        ))}
                        {!detail.externalReferences.length && (
                            <section className="unit-files-detail-section">
                                <h3>Integraciones</h3>
                                <p>Sin asignar</p>
                            </section>
                        )}
                    </>
                )}
            </Drawer>
            <Modal
                zIndex={ADMINISTRATION_MODAL_Z_INDEX}
                closable={{ "aria-label": "Cerrar comparación" }}
                rootClassName="unit-files-panel"
                title="Comparación de expedientes"
                open={comparing}
                width="min(1200px, 96vw)"
                footer={null}
                onCancel={() => {
                    comparisonSequence.current++;
                    setComparing(false);
                }}
            >
                {compareError && <p role="alert">{compareError}</p>}
                {compareBusy && (
                    <div className="unit-files-empty" role="status">
                        <span className="unit-files-spinner" />
                    </div>
                )}
                {!compareBusy && comparison.length > 0 && <UnitFilesComparison items={comparison} labels={FIELD_LABELS} groups={DETAIL_GROUPS} />}
            </Modal>
        </section>
    );
}
