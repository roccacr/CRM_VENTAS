import AuditOutlined from "@ant-design/icons/AuditOutlined";
import BankOutlined from "@ant-design/icons/BankOutlined";
import BranchesOutlined from "@ant-design/icons/BranchesOutlined";
import BuildOutlined from "@ant-design/icons/BuildOutlined";
import CalculatorOutlined from "@ant-design/icons/CalculatorOutlined";
import CalendarOutlined from "@ant-design/icons/CalendarOutlined";
import CheckSquareOutlined from "@ant-design/icons/CheckSquareOutlined";
import CloseCircleOutlined from "@ant-design/icons/CloseCircleOutlined";
import CloudOutlined from "@ant-design/icons/CloudOutlined";
import CommentOutlined from "@ant-design/icons/CommentOutlined";
import CreditCardOutlined from "@ant-design/icons/CreditCardOutlined";
import DollarOutlined from "@ant-design/icons/DollarOutlined";
import DownOutlined from "@ant-design/icons/DownOutlined";
import FileProtectOutlined from "@ant-design/icons/FileProtectOutlined";
import FileTextOutlined from "@ant-design/icons/FileTextOutlined";
import FlagOutlined from "@ant-design/icons/FlagOutlined";
import HistoryOutlined from "@ant-design/icons/HistoryOutlined";
import PercentageOutlined from "@ant-design/icons/PercentageOutlined";
import SafetyCertificateOutlined from "@ant-design/icons/SafetyCertificateOutlined";
import ScheduleOutlined from "@ant-design/icons/ScheduleOutlined";
import SettingOutlined from "@ant-design/icons/SettingOutlined";
import ShoppingCartOutlined from "@ant-design/icons/ShoppingCartOutlined";
import ShoppingOutlined from "@ant-design/icons/ShoppingOutlined";
import TagsOutlined from "@ant-design/icons/TagsOutlined";
import UnorderedListOutlined from "@ant-design/icons/UnorderedListOutlined";
import WarningOutlined from "@ant-design/icons/WarningOutlined";
import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react";

import type { FollowUpItem } from "../../services/formalization/follow-up-service";
import { type NetsuitePrimary, ORDER_ITEM_COLUMNS } from "../../services/formalization/netsuite-primary";
import { NotesTarget } from "../notes/PersonalNotes";
import { type CheckGroup, RECORD_EXAMPLE, type RecordChapterData, type RecordGroup } from "./formalization-record-example";
import { FormalizationBankAssignmentDetails } from "./FormalizationBankAssignmentDetails";
import { FormalizationClientDrawer } from "./FormalizationClientDrawer";
import { OutlookCompose } from "./FormalizationContractSend";
import { FormalizationMarkAddendum } from "./FormalizationMarkAddendum";
import { FormalizationOrderDocuments } from "./FormalizationOrderDocuments";
import { FormalizationOrderHistoryDrawer } from "./FormalizationOrderHistoryDrawer";
import { FormalizationScheduleEvent } from "./FormalizationScheduleEvent";
import { FormalizationUnitDrawer } from "./FormalizationUnitDrawer";
import { FormAssignBank } from "./FormAssignBank";
import { RecordFieldIcon } from "./RecordFieldIcon";
import { smoothScrollTo } from "./smooth-scroll";

const additionalIds = new Set(["articles", "reservation", "payment", "onedrive"]);
const BANK_ASSIGNMENT_CHAPTER = { id: "bank-assignment", label: "Banco y ejecutivo asignado" };

/** El perfil combina rol y excepciones personales; la API revalida módulo y lectura de orden. */
function canReadBankAssignment(permissions: readonly { readonly code: string; readonly effect: string }[]): boolean {
    const entries = permissions.filter((permission) => permission.code === "formalizacion.catalog_bank.read");
    return entries.some((permission) => permission.effect === "allow") && !entries.some((permission) => permission.effect === "deny");
}

/** Un ícono pequeño por título, para reconocer la parte antes de leerla. Es decorativo: las palabras siguen siendo el nombre accesible. */
const TITLE_ICONS: Readonly<Record<string, ReactNode>> = {
    "bank-assignment": <BankOutlined />,
    primary: <FileTextOutlined />,
    sales: <ShoppingOutlined />,
    authorization: <SafetyCertificateOutlined />,
    system: <SettingOutlined />,
    articles: <UnorderedListOutlined />,
    reservation: <ScheduleOutlined />,
    payment: <CreditCardOutlined />,
    onedrive: <CloudOutlined />,
    items: <UnorderedListOutlined />,
    Origen: <BranchesOutlined />,
    Compra: <ShoppingCartOutlined />,
    Fechas: <CalendarOutlined />,
    Cancelación: <CloseCircleOutlined />,
    Precios: <TagsOutlined />,
    Comisiones: <PercentageOutlined />,
    Notas: <CommentOutlined />,
    "Tractos de prima": <DollarOutlined />,
    "Forma de pago por avance de obra": <BuildOutlined />,
    Resumen: <CalculatorOutlined />,
    Estados: <CheckSquareOutlined />,
    "Hitos de la orden": <FlagOutlined />,
    Aprobaciones: <AuditOutlined />,
    "Cálculos de comisión": <CalculatorOutlined />,
    "Condiciones comerciales": <FileProtectOutlined />,
    Excepciones: <WarningOutlined />,
};

function TitleIcon({ name }: { readonly name: string }) {
    const icon = TITLE_ICONS[name];
    return icon ? (
        <span className="record-icon" aria-hidden="true">
            {icon}
        </span>
    ) : null;
}

const money = new Intl.NumberFormat("es-CR", { style: "currency", currency: RECORD_EXAMPLE.currency });
const show = (value: string | number | null | undefined, kind?: "money"): string => {
    if (value === null || value === undefined || /^[-–—\s]*$/.test(String(value))) return "Sin dato";
    return kind === "money" && typeof value === "number" ? money.format(value) : String(value);
};

// Oculto por decisión de producto hasta confirmar los identificadores de campo del proveedor.
const unconfirmedAuthorizationFields = new Set(["Comentario de autorización de venta", "Avisos importantes"]);

/** Solo se mapean los capítulos de NetSuite aprobados. Los valores no salen del ejemplo de presentación. */
function withOrder(chapters: readonly RecordChapterData[], primary: Partial<NetsuitePrimary> | null): readonly RecordChapterData[] {
    return chapters.map((chapter) => {
        const values = chapterValues(chapter.id, primary);
        return { ...chapter, ...(chapter.groups ? { groups: chapter.groups.map((group) => ({ ...group, fields: group.fields.filter((field) => chapter.id !== "authorization" || !unconfirmedAuthorizationFields.has(field.label)).map((field) => ({ ...field, value: values[field.label] ?? null })) })) } : {}) };
    });
}
/** Una recarga en caliente puede conservar una foto de antes de que existiera un capítulo recién mapeado. */
function chapterValues(id: string, data: Partial<NetsuitePrimary> | null): Readonly<Record<string, string | null>> {
    if (!data) return {};
    const values: Readonly<Record<string, Readonly<Record<string, string | null>> | undefined>> = { primary: data.fields, sales: data.sales, authorization: data.authorization, articles: data.articles, reservation: data.reservation, payment: data.payment };
    return values[id] ?? {};
}

/** Solo los cinco destacados autorizados, desde la proyección nativa del API. */
function Highlights({ item, onOpenClient, onOpenUnit }: { readonly item: FollowUpItem; readonly onOpenClient: () => void; readonly onOpenUnit: () => void }) {
    const facts = [
        ["Cliente", item.client],
        ["Proyecto · Unidad", [item.project?.name, item.unit].filter(Boolean).join(" · ")],
        ["Vendedor", item.seller?.name],
        ["Siguiente paso", item.nextStep],
    ] as const;
    return (
        <dl className="record-highlights" aria-label="Datos clave de la orden">
            {facts.map(([label, value]) => (
                <div key={label} data-wide={label === "Siguiente paso"}>
                    <dt>{label}</dt>
                    <dd>
                        {label === "Cliente" && value ? (
                            <button type="button" className="record-client-link" aria-label={"Ver cliente " + value} onClick={onOpenClient}>
                                {value}
                            </button>
                        ) : label === "Proyecto · Unidad" && item.unit ? (
                            <button type="button" className="record-client-link" aria-label={"Ver expediente de unidad " + item.unit} onClick={onOpenUnit}>
                                {value}
                            </button>
                        ) : (
                            value || "—"
                        )}
                    </dd>
                </div>
            ))}
        </dl>
    );
}

/**
 * Cuánto espacio necesita un valor, juzgado por el valor y no por el campo. Una respuesta corta ocupa una columna aunque el campo sea de texto largo,
 * una oración ocupa dos y un párrafo ocupa la fila. La grilla rellena, así que una fila no queda con un dato solo y un blanco al lado.
 */
function spanOf(shown: string): "1" | "2" | "full" {
    if (shown.length > 90 || shown.includes("\n")) return "full";
    return shown.length > 34 ? "2" : "1";
}

/** Conserva el layout y pinta solo los valores de campo mapeados de forma explícita. */
function FieldGroup({ group }: { readonly group: RecordGroup }) {
    const filled = group.fields;
    if (filled.length === 0) return null;
    return (
        <div className="record-group" {...(group.title ? { role: "group" as const, "aria-label": group.title } : {})}>
            {group.title ? (
                <h3>
                    <TitleIcon name={group.title} />
                    {group.title}
                </h3>
            ) : null}
            <dl>
                {filled.map((field) => {
                    const shown = show(field.value, field.kind);
                    return (
                        <div key={field.label} className="record-field" data-span={spanOf(shown)}>
                            <dt>
                                <RecordFieldIcon label={field.label} />
                                {field.label}
                            </dt>
                            <dd data-kind={field.kind} data-empty={shown === "Sin dato"}>
                                {shown}
                            </dd>
                        </div>
                    );
                })}
            </dl>
        </div>
    );
}

function RecordChapter({ chapter, open, focused, onToggle, children }: { readonly chapter: RecordChapterData; readonly open: boolean; readonly focused: boolean; readonly onToggle: () => void; readonly children?: ReactNode }) {
    return (
        <section className="record-chapter" data-open={open} data-focus={focused} data-chapter={chapter.id} aria-labelledby={`record-chapter-${chapter.id}`}>
            <h2 id={`record-chapter-${chapter.id}`}>
                <button type="button" aria-expanded={open} aria-controls={`record-body-${chapter.id}`} onClick={onToggle}>
                    <DownOutlined aria-hidden="true" />
                    <TitleIcon name={chapter.id} />
                    <span>{chapter.label}</span>
                </button>
            </h2>
            {open && (
                <div className="record-chapter__body" id={`record-body-${chapter.id}`}>
                    {children ?? (chapter.empty ? <p className="record-empty">Sin datos cargados.</p> : chapter.groups?.map((group) => <FieldGroup key={group.title || chapter.id} group={group} />))}
                </div>
            )}
        </section>
    );
}

function MoneySummary({ primary }: { readonly primary: Partial<NetsuitePrimary> | null }) {
    return (
        <section className="record-rail__money" aria-label="Resumen">
            <h3>
                <TitleIcon name="Resumen" />
                Resumen
            </h3>
            <dl>
                {RECORD_EXAMPLE.amounts.map((amount) => (
                    <div key={amount.label} className={amount.label === "Total" ? "is-total" : undefined}>
                        <dt>{amount.label}</dt>
                        <dd>{primary?.summary?.[amount.label] ?? "—"}</dd>
                    </div>
                ))}
            </dl>
        </section>
    );
}

/**
 * Read-only answers, one block per question, each with its own header so the groups do not run together. Marked or not is drawn as a box
 * (as in the system people already know) but nothing here can be clicked, and the words "Sí / No" are there for screen readers.
 */
function StatusGroups({ groups, primary }: { readonly groups: readonly CheckGroup[]; readonly primary: Partial<NetsuitePrimary> | null }) {
    return (
        <section className="record-rail__checks" aria-label="Estados de la orden">
            <h3>
                <span className="record-title">
                    <TitleIcon name="Estados" />
                    Estados
                </span>
                <span className="record-rail__readonly">Solo lectura</span>
            </h3>
            <div className="record-status">
                {groups.map((group) => {
                    return (
                        <section className="record-status__group" key={group.title} aria-label={group.title}>
                            <h4>
                                <TitleIcon name={group.title} />
                                {group.title}
                            </h4>
                            <ul aria-label={group.title}>
                                {group.items.map((item) => (
                                    <StatusFlag key={item.label} label={item.label} checked={primary?.checks?.[item.label] ?? null} />
                                ))}
                            </ul>
                        </section>
                    );
                })}
            </div>
        </section>
    );
}

function StatusFlag({ label, checked }: { readonly label: string; readonly checked: boolean | null }) {
    return (
        <li data-checked={checked === true}>
            <span aria-hidden="true" className={checked === null ? undefined : "record-tick"} data-checked={checked === true}>
                {checked === null ? "—" : checked ? "✓" : ""}
            </span>
            <span>{label}</span>
            <span className="record-sr">{checked === null ? "Sin dato" : checked ? "Sí" : "No"}</span>
        </li>
    );
}

/**
 * Una columna lateral fija más alta que la pantalla escondería su mitad de abajo. Si cabe, se fija con el tope a 56 px.
 * Si no cabe, se fija por su base al borde inferior: al desplazar la página se recorre toda la columna, sin un scroll propio que compita.
 */
function useStickyRail(ref: RefObject<HTMLElement | null>): void {
    useEffect(() => {
        const node = ref.current;
        if (!node) return undefined;
        const place = () => {
            node.style.setProperty("--rail-top", `${String(Math.min(56, window.innerHeight - node.offsetHeight - 16))}px`);
        };
        place();
        window.addEventListener("resize", place);
        const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
        observer?.observe(node);
        return () => {
            window.removeEventListener("resize", place);
            observer?.disconnect();
        };
    }, [ref]);
}

/** El capítulo que se está leyendo es el primero bajo la barra fija. Sin soporte de observer, como en pruebas, se queda el primero. */
function useActiveChapter(chapterKey: string): string {
    const [active, setActive] = useState(RECORD_EXAMPLE.chapters[0]?.id ?? "");
    useEffect(() => {
        if (typeof IntersectionObserver === "undefined") return undefined;
        const visible = new Map<string, number>();
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    const id = entry.target.getAttribute("data-chapter") ?? "";
                    if (entry.isIntersecting) visible.set(id, entry.boundingClientRect.top);
                    else visible.delete(id);
                }
                const first = [...visible].sort((a, b) => a[1] - b[1])[0];
                if (first) setActive(first[0]);
            },
            { rootMargin: "-110px 0px -55% 0px" },
        );
        for (const id of chapterKey.split("|")) {
            const node = document.getElementById(`record-chapter-${id}`)?.parentElement;
            if (node) observer.observe(node);
        }
        return () => {
            observer.disconnect();
        };
    }, [chapterKey]);
    return active;
}

/**
 * Jump links, not tabs: every part stays on the page and the link only takes you there (opening it if it was folded). The look says so:
 * a small "Ir a" label and plain links, the one in view in bold; no underline bar like a tab strip.
 */
function SectionBar({ chapters, closed, active, onGo, onAll, onHistory }: { readonly chapters: readonly RecordChapterData[]; readonly closed: ReadonlySet<string>; readonly active: string; readonly onGo: (id: string) => void; readonly onAll: (open: boolean) => void; readonly onHistory: () => void }) {
    return (
        <nav className="record-bar" aria-label="Secciones de la orden">
            <span className="record-bar__label">Ir a</span>
            <ul>
                {chapters
                    .filter((chapter) => !additionalIds.has(chapter.id))
                    .map((chapter) => (
                        <li key={chapter.id}>
                            <a
                                href={`#record-chapter-${chapter.id}`}
                                aria-current={active === chapter.id ? "location" : undefined}
                                onClick={(event) => {
                                    event.preventDefault();
                                    onGo(chapter.id);
                                }}
                            >
                                {chapter.id === BANK_ASSIGNMENT_CHAPTER.id ? "Banco y ejecutivo" : chapter.label}
                            </a>
                        </li>
                    ))}
            </ul>
            <button type="button" className="record-bar__history" onClick={onHistory}>
                <HistoryOutlined aria-hidden="true" />
                Ver bitácora de la orden
            </button>
            <button
                type="button"
                onClick={() => {
                    onAll(closed.size > 0);
                }}
            >
                {closed.size > 0 ? "Expandir todo" : "Contraer todo"}
            </button>
        </nav>
    );
}

/** Las líneas de artículo de la orden, como tabla en el mismo marco que las secciones. */
function OrderItems({ primary }: { readonly primary: Partial<NetsuitePrimary> | null }) {
    return (
        <section className="record-chapter record-items" aria-label="Líneas de artículos">
            <h2>
                <span className="record-items__title">
                    <TitleIcon name="items" />
                    Líneas de artículos
                </span>
                {primary?.items?.length ? <span className="record-items__count">{primary.items.length === 1 ? "1 línea" : `${String(primary.items.length)} líneas`}</span> : null}
            </h2>
            <div className="record-items__scroll" role="region" aria-label="Tabla de artículos de la orden" tabIndex={0}>
                <table>
                    <thead>
                        <tr>
                            {ORDER_ITEM_COLUMNS.map((label, index) => (
                                <th key={label} scope="col" data-numeric={[2, 4, 5, 6].includes(index)}>
                                    {label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {primary?.items?.length ? (
                            primary.items.map((line) => (
                                <tr key={line.key}>
                                    {ORDER_ITEM_COLUMNS.map((label, index) => (
                                        <td key={label} data-numeric={[2, 4, 5, 6].includes(index)}>
                                            {line.values[index] ?? "Sin dato"}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={ORDER_ITEM_COLUMNS.length}>Sin líneas de artículos disponibles.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

/**
 * One reading of the sale file. Facts stay in the main column, in named groups; money and answers stay in the right margin.
 * Field values await explicit mapping; this scaffold contains no example values.
 */
export function FormalizationRecordSummary({ item, primary = null, effectivePermissions = [], onNavigate, onAddendumChanged, overview }: { readonly overview?: ReactNode; readonly item: FollowUpItem; readonly primary?: Partial<NetsuitePrimary> | null; readonly onNavigate?: ((path: string) => void) | undefined; readonly onAddendumChanged?: (() => void | Promise<void>) | undefined; readonly effectivePermissions?: readonly { readonly code: string; readonly effect: string }[] }) {
    const [panel, setPanel] = useState<"client" | "unit" | "history" | null>(null);
    const [selectedDetail, setSelectedDetail] = useState("articles");
    const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
    const [focused, setFocused] = useState<string | null>(null);
    const [bankRevision, setBankRevision] = useState(0);
    const chapters: readonly RecordChapterData[] = [...withOrder(RECORD_EXAMPLE.chapters, primary), ...(canReadBankAssignment(effectivePermissions) ? [BANK_ASSIGNMENT_CHAPTER] : [])];
    const active = useActiveChapter(chapters.map((chapter) => chapter.id).join("|"));
    const refreshAfterCalendar = () => {
        // El formulario ya cerró; las consultas del marcador y tablero presentan sus propios fallos de recarga.
        void Promise.resolve()
            .then(onAddendumChanged)
            .catch(() => undefined);
    };
    const timer = useRef<number | undefined>(undefined);
    const rail = useRef<HTMLElement>(null);
    useStickyRail(rail);
    useEffect(
        () => () => {
            window.clearTimeout(timer.current);
        },
        [],
    );
    // Ir a una parte: se abre si está cerrada, se desliza hasta ella cuando ya está dibujada y se tinta un momento para que sea la que se ve.
    const go = (id: string) => {
        setClosed((current) => {
            const next = new Set(current);
            next.delete(id);
            return next;
        });
        setFocused(id);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
            setFocused(null);
        }, 2400);
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const heading = document.getElementById(`record-chapter-${id}`);
                if (heading?.parentElement) smoothScrollTo(heading.parentElement, 56);
            });
        });
    };
    const toggle = (id: string) => {
        setClosed((current) => {
            const next = new Set(current);
            if (!next.delete(id)) next.add(id);
            return next;
        });
    };
    return (
        <div className="record-page" data-order-id={item.id}>
            <NotesTarget source={item.source} id={item.id} label={`Orden de venta ${item.number}`} />
            <div className="record-overview">
                <section className="record-summary-card" aria-label="Resumen de la orden">
                    <header className="record-summary-card__head">
                        <h2>Resumen de la orden</h2>
                        <div className="record-summary-card__markers">{overview}</div>
                    </header>
                    <Highlights
                        item={item}
                        onOpenUnit={() => {
                            setPanel("unit");
                        }}
                        onOpenClient={() => {
                            setPanel("client");
                        }}
                    />
                </section>
                <div className="record-overview__cards">
                    <OutlookCompose item={item} />
                </div>
            </div>
            <section className="record-quick-actions" aria-label="Acciones rápidas">
                <h2 className="formalization-section-title">Acciones rápidas</h2>
                <div className="record-actions">
                    <FormAssignBank
                        key={`bank:${item.source}:${item.id}`}
                        item={item}
                        onAssigned={() => {
                            setBankRevision((value) => value + 1);
                        }}
                    />
                    <FormalizationMarkAddendum item={item} permissions={effectivePermissions} onSaved={onAddendumChanged} />
                    <FormalizationScheduleEvent key={`${item.source}:${item.id}`} item={item} effectivePermissions={effectivePermissions} onClosed={refreshAfterCalendar} />
                </div>
            </section>
            <FormalizationClientDrawer
                onCalendarClosed={refreshAfterCalendar}
                onNavigate={onNavigate}
                effectivePermissions={effectivePermissions}
                item={item}
                open={panel === "client"}
                onClose={() => {
                    setPanel(null);
                }}
            />

            <FormalizationUnitDrawer
                item={item}
                open={panel === "unit"}
                onClose={() => {
                    setPanel(null);
                }}
            />
            <FormalizationOrderHistoryDrawer
                item={item}
                open={panel === "history"}
                onClose={() => {
                    setPanel(null);
                }}
            />

            <SectionBar
                chapters={chapters}
                closed={closed}
                active={active}
                onGo={go}
                onHistory={() => {
                    setPanel("history");
                }}
                onAll={(open) => {
                    setClosed(open ? new Set() : new Set(chapters.map((chapter) => chapter.id)));
                }}
            />
            <div className="record-workspace">
                <div className="record-main">
                    {chapters
                        .filter((chapter) => !additionalIds.has(chapter.id))
                        .map((chapter) => (
                            <RecordChapter
                                key={chapter.id}
                                chapter={chapter}
                                open={!closed.has(chapter.id)}
                                focused={focused === chapter.id}
                                onToggle={() => {
                                    toggle(chapter.id);
                                }}
                            >
                                {chapter.id === BANK_ASSIGNMENT_CHAPTER.id ? (
                                    <FormalizationBankAssignmentDetails
                                        item={item}
                                        revision={bankRevision}
                                        onChanged={() => {
                                            setBankRevision((value) => value + 1);
                                        }}
                                    />
                                ) : undefined}
                            </RecordChapter>
                        ))}
                    <section className="record-details" aria-label="Detalles adicionales de la orden">
                        <div className="record-details__tabs" role="tablist" aria-label="Detalles de la orden">
                            {chapters
                                .filter((chapter) => additionalIds.has(chapter.id))
                                .map((chapter, index, details) => (
                                    <button
                                        key={chapter.id}
                                        type="button"
                                        role="tab"
                                        id={`record-tab-${chapter.id}`}
                                        aria-selected={selectedDetail === chapter.id}
                                        aria-controls={`record-panel-${chapter.id}`}
                                        tabIndex={selectedDetail === chapter.id ? 0 : -1}
                                        onClick={() => {
                                            setSelectedDetail(chapter.id);
                                        }}
                                        onKeyDown={(event) => {
                                            const next = event.key === "ArrowRight" ? (index + 1) % details.length : event.key === "ArrowLeft" ? (index + details.length - 1) % details.length : event.key === "Home" ? 0 : event.key === "End" ? details.length - 1 : null;
                                            if (next === null) return;
                                            event.preventDefault();
                                            const target = details[next];
                                            if (target) {
                                                setSelectedDetail(target.id);
                                                document.getElementById(`record-tab-${target.id}`)?.focus();
                                            }
                                        }}
                                    >
                                        <TitleIcon name={chapter.id} />
                                        {chapter.label}
                                    </button>
                                ))}
                        </div>
                        {chapters
                            .filter((chapter) => additionalIds.has(chapter.id))
                            .map((chapter) => (
                                <div key={chapter.id} role="tabpanel" id={`record-panel-${chapter.id}`} aria-labelledby={`record-tab-${chapter.id}`} hidden={selectedDetail !== chapter.id} tabIndex={0} className="record-details__panel">
                                    {chapter.id === "onedrive" ? selectedDetail === "onedrive" ? <FormalizationOrderDocuments key={`${item.source}:${item.id}`} item={item} permissions={effectivePermissions} /> : null : chapter.groups?.map((group) => <FieldGroup key={group.title || chapter.id} group={group} />)}
                                </div>
                            ))}
                    </section>
                    <OrderItems primary={primary} />
                </div>
                <aside className="record-rail" ref={rail}>
                    <MoneySummary primary={primary} />
                    <StatusGroups groups={RECORD_EXAMPLE.checks} primary={primary} />
                </aside>
            </div>
        </div>
    );
}
