import ArrowRightOutlined from "@ant-design/icons/ArrowRightOutlined";
import ClockCircleOutlined from "@ant-design/icons/ClockCircleOutlined";
import SearchOutlined from "@ant-design/icons/SearchOutlined";
import Button from "antd/es/button";
import { type KeyboardEvent, useId, useState } from "react";

import { type FormalizationExample, formatOrderTotal, isUnassigned, matchesPreviewFilter, type PreviewFilter, type PreviewQueue } from "./formalization-preview.model";
import { FormalizationEmptyValue, FormalizationStatusPill } from "./FormalizationStatusPill";

const queues = ["Todas", "Pendientes de aprobación", "Contratos pendientes", "Gestión bancaria", "Pendientes de saldo", "Traspasos pendientes", "Traspaso firmado", "Formalizaciones cerradas este año"] as const;
const columns = ["Orden / Cliente", "Proyecto / Unidad", "Etapa / Pendiente", "Responsable / Tiempo", "Siguiente paso"] as const;

// Pending a canonical follow-up source. Preview session fixtures are not business results.
const examples: readonly FormalizationExample[] = [];
const projects = [...new Set(examples.map((item) => item.project))];
const owners = [...new Set(examples.map((item) => item.owner))];

type Example = FormalizationExample;
type Queue = (typeof queues)[number];

const queueFilters: Record<Queue, PreviewFilter> = { Todas: "all", "Pendientes de aprobación": "approvals", "Contratos pendientes": "contracts", "Gestión bancaria": "bank", "Pendientes de saldo": "balance", "Traspasos pendientes": "transfer", "Traspaso firmado": "signed", "Formalizaciones cerradas este año": "closed" };
const matchesQueue = (item: Example, queue: Queue) => matchesPreviewFilter(item, queueFilters[queue]);
const matchesQuery = (item: Example, query: string) => `${item.id} ${item.client} ${item.project} ${item.unit} ${item.owner}`.toLocaleLowerCase("es").includes(query.trim().toLocaleLowerCase("es"));
const matchesFilter = (value: string, expected: string) => !expected || value === expected;

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

function QueueSelect({ queue, counts, onChange, options }: { readonly queue: Queue; readonly counts: (name: Queue) => number; readonly onChange: (queue: Queue) => void; readonly options: readonly Queue[] }) {
    return (
        <label className="formalization-field formalization-field--queue">
            <span>Bandeja</span>
            <select
                aria-label="Bandeja de seguimiento"
                value={queue}
                onChange={(event) => {
                    onChange(options.find((name) => name === event.target.value) ?? "Todas");
                }}
            >
                {options.map((name) => (
                    <option key={name} value={name}>
                        {name} ({counts(name)})
                    </option>
                ))}
            </select>
        </label>
    );
}

interface OrderFiltersProps {
    readonly options: readonly Queue[];
    readonly queue: Queue;
    readonly onQueue: (queue: Queue) => void;
    readonly project: string;
    readonly owner: string;
    readonly hasCriteria: boolean;
    readonly onProject: (value: string) => void;
    readonly onOwner: (value: string) => void;
    readonly onClear: () => void;
}

function OrderFilters({ queue, onQueue, project, owner, hasCriteria, onProject, onOwner, onClear, options }: OrderFiltersProps) {
    const active = [project, owner, queue !== "Todas"].filter(Boolean).length;
    return (
        <>
            <label className="formalization-field">
                <span>Etapa</span>
                <select
                    aria-label="Filtrar etapa de Formalización"
                    value={queue}
                    onChange={(event) => {
                        onQueue(options.find((name) => name === event.target.value) ?? "Todas");
                    }}
                >
                    {options.map((name) => (
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
                    {projects.map((name) => (
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
                    {owners.map((name) => (
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
            <span className="formalization-followup__icon" aria-hidden="true">
                <img src={`${import.meta.env.BASE_URL}illustrations/formalization-icons/contracts.svg`} width={24} height={24} alt="" />
            </span>
            <div className="formalization-followup__heading">
                <div className="formalization-title-row">
                    <h2 id={titleId}>Pendientes de seguimiento</h2>
                    <span className="formalization-total">{formatOrderTotal(total)}</span>
                </div>
            </div>
        </div>
    );
}

/** Keeps follow-up empty until a real source is connected; never falls back to preview fixtures. */
export function FormalizationFollowUpPreview({ onOpenOrder, tableOnly, scope, canViewApprovals = false }: { readonly onOpenOrder: (order: Example) => void; readonly tableOnly: boolean; readonly scope: PreviewQueue; readonly canViewApprovals?: boolean }) {
    const prefix = useId();
    const [selectedQueue, setQueue] = useState<Queue>("Todas");
    const options = queues.filter((name) => canViewApprovals || name !== "Pendientes de aprobación");
    const queue = options.includes(selectedQueue) ? selectedQueue : "Todas";
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
            <div className="formalization-toolbar" data-home={!tableOnly}>
                <SearchBox value={query} onChange={setQuery} />
                {tableOnly ? (
                    <OrderFilters
                        options={options}
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
                    <>
                        <label className="formalization-field">
                            <span>Proyecto</span>
                            <select
                                aria-label="Filtrar por proyecto"
                                value={project}
                                onChange={(event) => {
                                    setProject(event.target.value);
                                }}
                            >
                                <option value="">Todos los proyectos</option>
                                {projects.map((name) => (
                                    <option key={name} value={name}>
                                        {name}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <QueueSelect options={options} queue={queue} counts={(name) => searched.filter((item) => matchesQueue(item, name)).length} onChange={setQueue} />
                    </>
                )}
            </div>
            <div id={`${prefix}-panel`} role="region" aria-label="Órdenes filtradas" className="formalization-grid-scroll" tabIndex={0}>
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
                                    <strong>Seguimiento no disponible</strong>
                                    <span>El seguimiento de órdenes aún no está disponible.</span>
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
