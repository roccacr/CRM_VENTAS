import DownOutlined from "@ant-design/icons/DownOutlined";
import { type RefObject, useEffect, useRef, useState } from "react";

import type { FollowUpItem } from "../../services/formalization/follow-up-service";
import { type CheckGroup, RECORD_EXAMPLE, type RecordChapterData, type RecordGroup } from "./formalization-record-example";
import { FormalizationClientDrawer } from "./FormalizationClientDrawer";
import { smoothScrollTo } from "./smooth-scroll";

const money = new Intl.NumberFormat("es-CR", { style: "currency", currency: RECORD_EXAMPLE.currency });
const show = (value: string | number | null | undefined, kind?: "money"): string => {
    if (value === null || value === undefined || value === "") return "Sin dato";
    return kind === "money" && typeof value === "number" ? money.format(value) : String(value);
};

/** Empty scaffold until each field is explicitly mapped to the canonical payload. */
function withOrder(chapters: readonly RecordChapterData[]): readonly RecordChapterData[] {
    return chapters.map((chapter) => ({ ...chapter, ...(chapter.groups ? { groups: chapter.groups.map((group) => ({ ...group, fields: group.fields.map((field) => ({ ...field, value: null })) })) } : {}) }));
}

/** Only the five authorized highlights, from the API's native-first database projection. */
function Highlights({ item, onOpenClient }: { readonly item: FollowUpItem; readonly onOpenClient: () => void }) {
    const facts = [
        ["Cliente", item.client],
        ["Proyecto · Unidad", [item.project?.name, item.unit].filter(Boolean).join(" · ")],
        ["Vendedor", item.seller?.name],
        ["Etapa", item.state.label],
        ["Siguiente paso", item.nextStep],
    ] as const;
    return (
        <dl className="record-highlights" aria-label="Datos clave de la orden">
            {facts.map(([label, value]) => (
                <div key={label}>
                    <dt>{label}</dt>
                    <dd>
                        {label === "Cliente" && value ? (
                            <button type="button" className="record-client-link" aria-label={"Ver cliente " + value} onClick={onOpenClient}>
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

/** Preserve each unmapped field label with an empty value until its mapping is approved. */
function FieldGroup({ group }: { readonly group: RecordGroup }) {
    const filled = group.fields;
    if (filled.length === 0) return null;
    return (
        <div className="record-group" {...(group.title ? { role: "group" as const, "aria-label": group.title } : {})}>
            {group.title ? <h3>{group.title}</h3> : null}
            <dl>
                {filled.map((field) => (
                    <div key={field.label} className={field.wide ? "record-field record-field--wide" : "record-field"}>
                        <dt>{field.label}</dt>
                        <dd data-kind={field.kind}>{show(field.value, field.kind)}</dd>
                    </div>
                ))}
            </dl>
        </div>
    );
}

function RecordChapter({ chapter, open, focused, onToggle }: { readonly chapter: RecordChapterData; readonly open: boolean; readonly focused: boolean; readonly onToggle: () => void }) {
    return (
        <section className="record-chapter" data-open={open} data-focus={focused} data-chapter={chapter.id} aria-labelledby={`record-chapter-${chapter.id}`}>
            <h2 id={`record-chapter-${chapter.id}`}>
                <button type="button" aria-expanded={open} aria-controls={`record-body-${chapter.id}`} onClick={onToggle}>
                    <DownOutlined aria-hidden="true" />
                    <span>{chapter.label}</span>
                </button>
            </h2>
            {open && (
                <div className="record-chapter__body" id={`record-body-${chapter.id}`}>
                    {chapter.empty ? <p className="record-empty">Sin datos cargados.</p> : chapter.groups?.map((group) => <FieldGroup key={group.title || chapter.id} group={group} />)}
                </div>
            )}
        </section>
    );
}

function MoneySummary() {
    return (
        <section className="record-rail__money" aria-label="Resumen">
            <h3>Resumen</h3>
            <dl>
                {RECORD_EXAMPLE.amounts.map((amount) => (
                    <div key={amount.label} className={amount.label === "Total" ? "is-total" : undefined}>
                        <dt>{amount.label}</dt>
                        <dd>—</dd>
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
function StatusGroups({ groups }: { readonly groups: readonly CheckGroup[] }) {
    return (
        <section className="record-rail__checks" aria-label="Estados de la orden">
            <h3>
                Estados
                <span className="record-rail__readonly">Solo lectura</span>
            </h3>
            <div className="record-status">
                {groups.map((group) => {
                    return (
                        <section className="record-status__group" key={group.title} aria-label={group.title}>
                            <h4>{group.title}</h4>
                            <ul aria-label={group.title}>
                                {group.items.map((item) => (
                                    <li key={item.label} data-checked={false}>
                                        <span aria-hidden="true">—</span>
                                        <span>{item.label}</span>
                                        <span className="record-sr">Sin dato</span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    );
                })}
            </div>
        </section>
    );
}

/**
 * A sticky side column taller than the screen would hide its lower half. So it sticks with its top at 56px when it fits, and, when it does not,
 * with its BOTTOM at the screen's bottom: scrolling the page then walks through the whole column, with no scroll of its own to fight with.
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

/** The chapter being read: the first one under the sticky bar. Without observer support (tests) the first one stays. */
function useActiveChapter(): string {
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
        for (const chapter of RECORD_EXAMPLE.chapters) {
            const node = document.getElementById(`record-chapter-${chapter.id}`)?.parentElement;
            if (node) observer.observe(node);
        }
        return () => {
            observer.disconnect();
        };
    }, []);
    return active;
}

/**
 * Jump links, not tabs: every part stays on the page and the link only takes you there (opening it if it was folded). The look says so:
 * a small "Ir a" label and plain links, the one in view in bold; no underline bar like a tab strip.
 */
function SectionBar({ closed, active, onGo, onAll }: { readonly closed: ReadonlySet<string>; readonly active: string; readonly onGo: (id: string) => void; readonly onAll: (open: boolean) => void }) {
    return (
        <nav className="record-bar" aria-label="Secciones de la orden">
            <span className="record-bar__label">Ir a</span>
            <ul>
                {RECORD_EXAMPLE.chapters.map((chapter) => (
                    <li key={chapter.id}>
                        <a
                            href={`#record-chapter-${chapter.id}`}
                            aria-current={active === chapter.id ? "location" : undefined}
                            onClick={(event) => {
                                event.preventDefault();
                                onGo(chapter.id);
                            }}
                        >
                            {chapter.label}
                        </a>
                    </li>
                ))}
            </ul>
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

/**
 * One reading of the sale file. Facts stay in the main column, in named groups; money and answers stay in the right margin.
 * Field values await explicit mapping; this scaffold contains no example values.
 */
export function FormalizationRecordSummary({ item }: { readonly item: FollowUpItem }) {
    const [clientOpen, setClientOpen] = useState(false);
    const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
    const [focused, setFocused] = useState<string | null>(null);
    const active = useActiveChapter();
    const chapters = withOrder(RECORD_EXAMPLE.chapters);
    const timer = useRef<number | undefined>(undefined);
    const rail = useRef<HTMLElement>(null);
    useStickyRail(rail);
    useEffect(
        () => () => {
            window.clearTimeout(timer.current);
        },
        [],
    );
    // Going to a part: open it if it is closed, glide down to it once it is drawn, and tint it a little greyer for a moment so it is the one you see.
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
            <Highlights
                item={item}
                onOpenClient={() => {
                    setClientOpen(true);
                }}
            />
            <FormalizationClientDrawer
                item={item}
                open={clientOpen}
                onClose={() => {
                    setClientOpen(false);
                }}
            />

            <SectionBar
                closed={closed}
                active={active}
                onGo={go}
                onAll={(open) => {
                    setClosed(open ? new Set() : new Set(chapters.map((chapter) => chapter.id)));
                }}
            />
            <div className="record-workspace">
                <div className="record-main">
                    {chapters.map((chapter) => (
                        <RecordChapter
                            key={chapter.id}
                            chapter={chapter}
                            open={!closed.has(chapter.id)}
                            focused={focused === chapter.id}
                            onToggle={() => {
                                toggle(chapter.id);
                            }}
                        />
                    ))}
                </div>
                <aside className="record-rail" ref={rail}>
                    <MoneySummary />
                    <StatusGroups groups={RECORD_EXAMPLE.checks} />
                </aside>
            </div>
        </div>
    );
}
