import ArrowRightOutlined from "@ant-design/icons/ArrowRightOutlined";
import ClockCircleOutlined from "@ant-design/icons/ClockCircleOutlined";
import SearchOutlined from "@ant-design/icons/SearchOutlined";
import Button from "antd/es/button";
import { type KeyboardEvent, useId, useState } from "react";

import { type FormalizationExample, formatOrderTotal, isUnassigned, matchesPreviewFilter, PREVIEW_OWNERS, PREVIEW_PROJECTS, type PreviewQueue } from "./formalization-preview.model";
import { useFormalizationPreview } from "./formalization-preview-session";
import { FormalizationEmptyValue, FormalizationStatusPill } from "./FormalizationStatusPill";

const queues = ["Todas", "Contratos", "Gestión bancaria", "Pendientes de saldo", "Traspasos", "Por cerrar", "Cerradas", "Fase posterior"] as const;
const columns = ["Orden / Cliente", "Proyecto / Unidad", "Etapa / Pendiente", "Responsable / Tiempo", "Siguiente paso"] as const;

type Example = FormalizationExample;
type Queue = (typeof queues)[number];

const matchesQueue = (item: Example, queue: Queue) => queue === "Todas" || item.stage === queue;
const matchesQuery = (item: Example, query: string) => `${item.id} ${item.client} ${item.project} ${item.unit} ${item.owner}`.toLocaleLowerCase("es").includes(query.trim().toLocaleLowerCase("es"));
const matchesFilter = (value: string, expected: string) => !expected || value === expected;

/** La bandeja de Inicio usa pestañas; la lista filtrada expone una región con filtros propios. */
function getPanelProps(tableOnly: boolean, prefix: string, queue: Queue) {
    if (tableOnly) return { role: "region", "aria-label": "Órdenes filtradas" } as const;
    return { role: "tabpanel", "aria-labelledby": `${prefix}-tab-${String(queues.indexOf(queue))}` } as const;
}

function onRowKey(event: KeyboardEvent<HTMLTableRowElement>, open: () => void) {
    if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    open();
}

function SearchBox({ value, onChange }: { readonly value: string; readonly onChange: (value: string) => void }) {
    return (
        <label className="formalization-search">
            <SearchOutlined aria-hidden="true" />
            <input
                type="search"
                aria-label="Buscar operación"
                placeholder="Orden, cliente, unidad o responsable"
                value={value}
                onChange={(event) => {
                    onChange(event.target.value);
                }}
            />
        </label>
    );
}

function QueueTabs({ prefix, queue, counts, onChange }: { readonly prefix: string; readonly queue: Queue; readonly counts: (name: Queue) => number; readonly onChange: (queue: Queue) => void }) {
    return (
        <div className="formalization-queues" role="tablist" aria-label="Bandejas de seguimiento">
            {queues.map((name, index) => (
                <button
                    key={name}
                    id={`${prefix}-tab-${String(index)}`}
                    type="button"
                    role="tab"
                    aria-selected={queue === name}
                    aria-controls={`${prefix}-panel`}
                    tabIndex={queue === name ? 0 : -1}
                    onClick={() => {
                        onChange(name);
                    }}
                    onKeyDown={(event) => {
                        const positions: Record<string, number> = { ArrowRight: (index + 1) % queues.length, ArrowLeft: (index + queues.length - 1) % queues.length, Home: 0, End: queues.length - 1 };
                        const next = positions[event.key];
                        if (next === undefined) return;
                        event.preventDefault();
                        onChange(queues[next] ?? "Todas");
                        event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
                    }}
                >
                    {name} <span className="formalization-count-pill">{counts(name)}</span>
                </button>
            ))}
        </div>
    );
}

interface OrderFiltersProps {
    readonly queue: Queue;
    readonly onQueue: (queue: Queue) => void;
    readonly project: string;
    readonly owner: string;
    readonly hasCriteria: boolean;
    readonly onProject: (value: string) => void;
    readonly onOwner: (value: string) => void;
    readonly onClear: () => void;
}

function OrderFilters({ queue, onQueue, project, owner, hasCriteria, onProject, onOwner, onClear }: OrderFiltersProps) {
    const active = [project, owner, queue !== "Todas"].filter(Boolean).length;
    return (
        <>
            <label className="formalization-field">
                <span>Etapa</span>
                <select
                    aria-label="Filtrar etapa de Formalización"
                    value={queue}
                    onChange={(event) => {
                        onQueue(queues.find((name) => name === event.target.value) ?? "Todas");
                    }}
                >
                    {queues.map((name) => (
                        <option key={name}>{name}</option>
                    ))}
                </select>
            </label>
            <label className="formalization-field">
                <span>Proyecto</span>
                <select
                    value={project}
                    onChange={(event) => {
                        onProject(event.target.value);
                    }}
                >
                    <option value="">Todos</option>
                    {PREVIEW_PROJECTS.map((name) => (
                        <option key={name}>{name}</option>
                    ))}
                </select>
            </label>
            <label className="formalization-field">
                <span>Responsable</span>
                <select
                    value={owner}
                    onChange={(event) => {
                        onOwner(event.target.value);
                    }}
                >
                    <option value="">Todos</option>
                    {PREVIEW_OWNERS.map((name) => (
                        <option key={name}>{name}</option>
                    ))}
                </select>
            </label>
            <div className="formalization-toolbar__commands" aria-live="polite">
                {active > 0 && <span className="formalization-filter-counter">Filtros activos: {active}</span>}
                {hasCriteria && (
                    <Button className="formalization-command" onClick={onClear}>
                        Limpiar
                    </Button>
                )}
            </div>
        </>
    );
}

function FollowUpRow({ item, onOpenOrder }: { readonly item: Example; readonly onOpenOrder: (order: Example) => void }) {
    const open = () => {
        onOpenOrder(item);
    };
    return (
        <tr
            className="formalization-grid__row"
            tabIndex={0}
            aria-label={`Abrir orden ${item.id}`}
            onClick={open}
            onKeyDown={(event) => {
                onRowKey(event, open);
            }}
        >
            <td>
                <strong className="formalization-grid__primary">{item.id}</strong>
                <span className="formalization-grid__meta">{item.client}</span>
            </td>
            <td data-label={columns[1]}>
                <span className="formalization-grid__value">{item.project}</span>
                <span className="formalization-grid__meta">{item.unit}</span>
            </td>
            <td data-label={columns[2]}>
                <FormalizationStatusPill item={item} />
                <span className="formalization-grid__meta">{item.blocker}</span>
            </td>
            <td data-label={columns[3]}>
                {isUnassigned(item) ? <FormalizationEmptyValue /> : <span className="formalization-grid__value">{item.owner}</span>}
                <span className="formalization-grid__meta formalization-grid__age">
                    <ClockCircleOutlined aria-hidden="true" /> <strong>{item.days}</strong> días en etapa
                </span>
            </td>
            <td data-label={columns[4]}>
                <div className="formalization-grid__next">
                    <span>{item.next}</span>
                    <Button
                        className="formalization-open"
                        icon={<ArrowRightOutlined />}
                        aria-label={`Ver seguimiento de ${item.id}`}
                        title="Ver seguimiento"
                        onClick={(event) => {
                            event.stopPropagation();
                            open();
                        }}
                    />
                </div>
            </td>
        </tr>
    );
}

function FollowUpHeader({ titleId, total }: { readonly titleId: string; readonly total: number }) {
    return (
        <div className="formalization-surface__header">
            <div>
                <div className="formalization-title-row">
                    <h2 id={titleId}>Pendientes de seguimiento</h2>
                    <span className="formalization-total">{formatOrderTotal(total)}</span>
                </div>
                <p>
                    <ClockCircleOutlined aria-hidden="true" /> Mayor antigüedad primero · Días en la etapa actual
                </p>
            </div>
        </div>
    );
}

/** Bandeja demostrativa; búsqueda, bandejas y filtros operan solo sobre datos locales. */
export function FormalizationFollowUpPreview({ onOpenOrder, tableOnly, scope }: { readonly onOpenOrder: (order: Example) => void; readonly tableOnly: boolean; readonly scope: PreviewQueue }) {
    const { orders: examples } = useFormalizationPreview();
    const prefix = useId();
    const [queue, setQueue] = useState<Queue>("Todas");
    const [query, setQuery] = useState("");
    const [project, setProject] = useState(() => scope.project ?? "");
    const [owner, setOwner] = useState("");
    const scoped = examples.filter((item) => matchesPreviewFilter(item, scope.filter));
    const searched = scoped.filter((item) => matchesQuery(item, query) && matchesFilter(item.project, project) && matchesFilter(item.owner, owner));
    const filtered = searched.filter((item) => matchesQueue(item, queue));
    const hasCriteria = [project, owner, query.trim(), queue !== "Todas"].some(Boolean);

    return (
        <section className="formalization-surface formalization-followup" aria-labelledby={`${prefix}-title`}>
            {tableOnly ? (
                <h2 id={`${prefix}-title`} className="formalization-sr">
                    Órdenes de venta
                </h2>
            ) : (
                <FollowUpHeader titleId={`${prefix}-title`} total={scoped.length} />
            )}
            <div className="formalization-toolbar">
                <SearchBox value={query} onChange={setQuery} />
                {tableOnly ? (
                    <OrderFilters
                        queue={queue}
                        onQueue={setQueue}
                        project={project}
                        owner={owner}
                        hasCriteria={hasCriteria}
                        onProject={setProject}
                        onOwner={setOwner}
                        onClear={() => {
                            setProject("");
                            setOwner("");
                            setQuery("");
                            setQueue("Todas");
                        }}
                    />
                ) : (
                    <QueueTabs prefix={prefix} queue={queue} counts={(name) => searched.filter((item) => matchesQueue(item, name)).length} onChange={setQueue} />
                )}
            </div>
            <div id={`${prefix}-panel`} {...getPanelProps(tableOnly, prefix, queue)} className="formalization-grid-scroll" tabIndex={0}>
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
                        {filtered.map((item) => (
                            <FollowUpRow key={item.id} item={item} onOpenOrder={onOpenOrder} />
                        ))}
                        {filtered.length === 0 && (
                            <tr>
                                <td colSpan={columns.length} className="formalization-grid__empty">
                                    <strong>Sin resultados</strong>
                                    <span>No hay operaciones con estos criterios.</span>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <div className="formalization-surface__footer">
                Mostrando {filtered.length} de {scoped.length} operaciones
            </div>
        </section>
    );
}
