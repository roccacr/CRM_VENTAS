import "../administration/components/UserDetailDrawer.css";
import "./NoteCollaboration.css";
import "./PersonalNotes.css";

import BellOutlined from "@ant-design/icons/BellOutlined";
import CheckOutlined from "@ant-design/icons/CheckOutlined";
import MessageOutlined from "@ant-design/icons/MessageOutlined";
import TeamOutlined from "@ant-design/icons/TeamOutlined";
import UserOutlined from "@ant-design/icons/UserOutlined";
import Drawer from "antd/es/drawer";
import Typography from "antd/es/typography";
import { useCallback, useEffect, useRef, useState } from "react";

import { ApiClientError } from "../../services/api/api-client";
import { getNoteNotifications, getNoteUnreadCount, markAllNoteNotificationsRead, markNoteNotificationRead, type NoteNotification, type NoteNotifications } from "../../services/notes/note-notifications-service";
import { ADMINISTRATION_DRAWER_CLOSE_PLACEMENT, ADMINISTRATION_DRAWER_PROPS } from "../administration/administration-theme";
import { CalendarNotificationList } from "../calendar/CalendarNotifications";
import { useCalendarNotifications } from "../calendar/useCalendarNotifications";
import { NotesLoading } from "./NotesLoading";
import { useNotesRealtime } from "./useNotesRealtime";
interface Props {
    readonly onOpenNote: (id: string) => void;
    readonly mobile?: boolean;
    readonly enabled?: boolean;
}
/** Both header variants share realtime; only the visible bell reads counts and announces notices. */
export function NoteNotificationsButton({ onOpenNote, mobile = false, enabled = true }: Props) {
    const [open, setOpen] = useState(false);
    const alive = useRef(true);
    const refreshSequence = useRef(0);
    const reading = useRef(new Map<string, number>());
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
        };
    }, []);
    const [count, setCount] = useState<number | null>(null);
    const [lower, setLower] = useState(false);
    const [viewport, setViewport] = useState(() => window.innerWidth < 768 === mobile);
    useEffect(() => {
        const change = () => {
            setViewport(window.innerWidth < 768 === mobile);
        };
        window.addEventListener("resize", change);
        return () => {
            window.removeEventListener("resize", change);
        };
    }, [mobile]);
    const calendarNotices = useCalendarNotifications(viewport);
    const bellCount = Number(count) + calendarNotices.unreadCount;
    const refresh = useCallback(async () => {
        if (reading.current.size) return;
        const key = ++refreshSequence.current;
        try {
            const result = await getNoteUnreadCount();
            if (!alive.current || key !== refreshSequence.current || reading.current.size) return;
            setCount(result.count);
            setLower(result.countIsLowerBound);
        } catch {
            if (alive.current && key === refreshSequence.current) setCount(null);
        }
    }, []);
    const [notice, setNotice] = useState("");
    useEffect(() => {
        if (!notice) return;
        const timer = window.setTimeout(() => {
            setNotice("");
        }, 8000);
        return () => {
            window.clearTimeout(timer);
        };
    }, [notice]);
    const realtime = useNotesRealtime(
        "notifications",
        async (event) => {
            await refresh();
            if (event?.kind === "notification.created") setNotice("Tienes una nueva notificación de notas.");
        },
        enabled && viewport,
    );
    useEffect(() => {
        if (!enabled || !viewport || realtime) return;
        let active = true;
        const update = () => {
            if (active && document.visibilityState !== "hidden") void refresh();
        };
        void Promise.resolve().then(update);
        const timer = window.setInterval(update, 60000);
        document.addEventListener("visibilitychange", update);
        return () => {
            active = false;
            window.clearInterval(timer);
            document.removeEventListener("visibilitychange", update);
        };
    }, [enabled, viewport, refresh, realtime]);
    return (
        <>
            <span className="note-realtime-notice" role="status" aria-live="polite">
                {viewport ? notice : ""}
            </span>
            <button
                className={`${mobile ? "global-home-mobile-bar__icon-button" : "global-home-header__icon-button"} note-bell`}
                type="button"
                aria-label="Notificaciones"
                title={count === null ? "Notificaciones" : `Notificaciones · ${String(bellCount)} sin leer`}
                onClick={() => {
                    setOpen(true);
                    void calendarNotices.refresh();
                }}
            >
                <BellOutlined aria-hidden="true" />
                <BellCount count={bellCount} lower={lower} />
            </button>
            <Drawer
                {...ADMINISTRATION_DRAWER_PROPS}
                rootClassName="user-detail-drawer note-notifications-drawer"
                title={
                    <div className="user-detail-drawer__identity">
                        <span className="personal-notes-drawer__avatar" aria-hidden="true">
                            <BellOutlined />
                        </span>
                        <div className="user-detail-drawer__identity-copy">
                            <Typography.Title level={4}>Notificaciones</Typography.Title>
                            <Typography.Text type="secondary">Invitaciones de calendario y avisos de notas</Typography.Text>
                        </div>
                    </div>
                }
                closable={{ placement: ADMINISTRATION_DRAWER_CLOSE_PLACEMENT }}
                open={open}
                onClose={() => {
                    setOpen(false);
                }}
            >
                <CalendarNotificationList
                    model={calendarNotices}
                    onOpen={() => {
                        setOpen(false);
                    }}
                />
                {enabled ? (
                    <NotificationsContent
                        open={open}
                        onReadStart={(key, amount) => {
                            reading.current.set(key, amount);
                            refreshSequence.current += 1;
                            setCount((old) => (old === null ? null : Math.max(0, old - amount)));
                        }}
                        onReadSettled={(key, confirmed) => {
                            const amount = reading.current.get(key) ?? 0;
                            reading.current.delete(key);
                            if (!alive.current) return;
                            if (!confirmed) setCount((old) => (old === null ? null : old + amount));
                            if (!reading.current.size) void refresh();
                        }}
                        onOpenNote={(id) => {
                            setOpen(false);
                            onOpenNote(id);
                        }}
                    />
                ) : (
                    <p>No hay notificaciones de notas disponibles para tu cuenta.</p>
                )}
            </Drawer>
        </>
    );
}
interface ContentProps {
    readonly open: boolean;
    readonly onReadStart: (key: string, amount: number) => void;
    readonly onReadSettled: (key: string, confirmed: boolean) => void;
    readonly onOpenNote: (id: string) => void;
}
interface ReadIntent {
    key: string;
    ids: string[];
    through: string | null;
    amount: number;
    confirmed: boolean;
}
const matchesRead = (item: NoteNotification, intent: ReadIntent) => intent.ids.includes(item.id) || (intent.through !== null && Date.parse(item.createdAt) <= Date.parse(intent.through));
/** Overlay read receipts until a fresh post-ack snapshot arrives; later notifications stay unread. */
function presentNotifications(data: NoteNotifications, reads: ReadIntent[], filter: "all" | "unread" | "mentions"): NoteNotifications {
    const items = data.items.map((item) => (item.readAt === null && reads.some((read) => matchesRead(item, read)) ? { ...item, readAt: new Date().toISOString() } : item));
    const unreadCount = Math.max(0, data.unreadCount - reads.reduce((sum, read) => sum + read.amount, 0));
    return { ...data, items: filter === "unread" ? items.filter((item) => item.readAt === null) : items, unreadCount };
}
function NotificationsContent({ open, onReadStart, onReadSettled, onOpenNote }: ContentProps) {
    const [filter, setFilter] = useState<"all" | "unread" | "mentions">("unread");
    const [page, setPage] = useState(1);
    const [data, setData] = useState<NoteNotifications | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [reads, setReads] = useState<ReadIntent[]>([]);
    const readIntents = useRef<ReadIntent[]>([]);
    const alive = useRef(true);
    const sequence = useRef(0);
    const updateReads = useCallback((next: ReadIntent[]) => {
        readIntents.current = next;
        if (alive.current) setReads(next);
    }, []);
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
        };
    }, []);
    const load = useCallback(async () => {
        const key = ++sequence.current;
        const isCurrent = () => alive.current && key === sequence.current;
        const confirmed = new Set(readIntents.current.filter((read) => read.confirmed).map((read) => read.key));
        setLoading(true);
        try {
            const result = await getNoteNotifications(filter, page);
            if (isCurrent()) {
                setData(result);
                updateReads(readIntents.current.filter((read) => !confirmed.has(read.key)));
                setError("");
            }
        } catch (reason) {
            if (isCurrent()) {
                if (reason instanceof ApiClientError && [401, 403, 404].includes(reason.status)) setData(null);
                setError("No se pudieron consultar tus avisos. Reintenta para comprobar tu acceso y conexión.");
            }
        } finally {
            if (isCurrent()) setLoading(false);
        }
    }, [filter, page, updateReads]);
    const reload = useRef(load);
    useEffect(() => {
        reload.current = load;
    }, [load]);
    useEffect(() => {
        if (open) void Promise.resolve().then(load);
    }, [open, load]);
    useNotesRealtime(
        "notifications",
        () => {
            if (open) return load();
        },
        open,
    );
    const read = async (intent: ReadIntent, request: () => Promise<void>) => {
        updateReads([...readIntents.current, intent]);
        setError("");
        onReadStart(intent.key, intent.amount);
        try {
            await request();
            intent.confirmed = true;
            onReadSettled(intent.key, true);
            if (alive.current) void reload.current();
        } catch {
            updateReads(readIntents.current.filter((read) => read.key !== intent.key));
            onReadSettled(intent.key, false);
            if (alive.current) setError("No se pudo confirmar la lectura del aviso. Puedes reintentarlo.");
        }
    };
    const mark = (id: string) => {
        const item = data?.items.find((row) => row.id === id);
        if (!item || item.readAt !== null || readIntents.current.some((intent) => matchesRead(item, intent))) return;
        void read({ key: crypto.randomUUID(), ids: [id], through: null, amount: 1, confirmed: false }, () => markNoteNotificationRead(id));
    };
    const markAll = () => {
        if (!data) return;
        const amount = presentNotifications(data, readIntents.current, filter).unreadCount;
        if (!amount) return;
        const through = data.observedAt;
        void read({ key: crypto.randomUUID(), ids: [], through, amount, confirmed: false }, () => markAllNoteNotificationsRead(through));
    };
    const visible = data ? presentNotifications(data, reads, filter) : null;
    const showInitialLoading = loading && data === null;
    return (
        <div className="note-notifications">
            <p className="note-notifications__hint">Solo tus avisos. Abrir la campana no los marca como leídos.</p>
            <NotificationTools
                filter={filter}
                hasData={data !== null}
                onFilter={(value) => {
                    setFilter(value);
                    setPage(1);
                }}
                onMarkAll={() => {
                    markAll();
                }}
            />
            {error && (
                <div role="alert" className="personal-notes-panel__error">
                    <p>{error}</p>
                    <button
                        type="button"
                        onClick={() => {
                            void load();
                        }}
                    >
                        Reintentar avisos
                    </button>
                </div>
            )}
            {showInitialLoading && <NotesLoading label="Cargando tus avisos…" />}
            {data && (
                <>
                    <NotificationList
                        items={visible?.items ?? []}
                        onMark={(id) => {
                            mark(id);
                        }}
                        onOpen={(item) => {
                            onOpenNote(item.noteId);
                            mark(item.id);
                        }}
                    />
                    <NotificationPagination page={page} pagination={data.page} onPage={setPage} />
                </>
            )}
        </div>
    );
}
interface ListProps {
    readonly items: NoteNotification[];
    readonly onMark: (id: string) => void;
    readonly onOpen: (item: NoteNotification) => void;
}
const KINDS = {
    assigned: { verb: "te asignó", icon: <UserOutlined /> },
    reminder: { verb: "te recuerda", icon: <BellOutlined /> },
    due: { verb: "avisa del vencimiento de", icon: <BellOutlined /> },
    shared: { verb: "te invitó a", icon: <TeamOutlined /> },
    reply: { verb: "respondió en", icon: <MessageOutlined /> },
    mention: { verb: "te mencionó en", icon: <UserOutlined /> },
};
const when = (iso: string): string => new Date(iso).toLocaleString("es-CR", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
function NotificationList({ items, onMark, onOpen }: ListProps) {
    const [grouped, setGrouped] = useState(true);
    const groups = new Map<string, NoteNotification[]>();
    for (const item of items) {
        const group = groups.get(item.noteId) ?? [];
        group.push(item);
        groups.set(item.noteId, group);
    }
    if (items.length === 0)
        return (
            <div className="personal-notes-panel__empty">
                <BellOutlined aria-hidden="true" />
                <p className="note-notifications-empty">No tienes avisos en esta selección.</p>
            </div>
        );
    return (
        <>
            <label>
                <input
                    type="checkbox"
                    checked={grouped}
                    onChange={(event) => {
                        setGrouped(event.target.checked);
                    }}
                />
                Agrupar avisos de la misma nota
            </label>
            {grouped ? (
                <ul className="note-notification-groups">
                    {Array.from(groups.entries()).map(([noteId, group]) => (
                        <li key={noteId}>
                            <details open={group.length === 1}>
                                <summary>
                                    {group[0]?.note.title ?? "Nota sin título"} · {group.length} {group.length === 1 ? "aviso" : "avisos"} · {group.filter((item) => item.readAt === null).length} sin leer
                                </summary>
                                <button
                                    type="button"
                                    disabled={group.every((item) => item.readAt !== null)}
                                    onClick={() => {
                                        for (const item of group) if (item.readAt === null) onMark(item.id);
                                    }}
                                >
                                    Marcar grupo visible como leído
                                </button>
                                <ul className="note-notification-list">
                                    {group.map((item) => (
                                        <NotificationItem key={item.id} item={item} onMark={onMark} onOpen={onOpen} />
                                    ))}
                                </ul>
                            </details>
                        </li>
                    ))}
                </ul>
            ) : (
                <ul className="note-notification-list">
                    {items.map((item) => (
                        <NotificationItem key={item.id} item={item} onMark={onMark} onOpen={onOpen} />
                    ))}
                </ul>
            )}
        </>
    );
}
/** Who did what, on which note, and what they wrote, in one compact row. Unread ones are marked by the blue edge. */
function NotificationItem({ item, onMark, onOpen }: { readonly item: NoteNotification; readonly onMark: (id: string) => void; readonly onOpen: (item: NoteNotification) => void }) {
    const kind = KINDS[item.kind];
    return (
        <li data-unread={item.readAt === null} data-kind={item.kind}>
            <button
                type="button"
                className="note-notification-list__open"
                aria-label={`Abrir nota: ${item.actor.displayName} ${kind.verb} una nota`}
                onClick={() => {
                    onOpen(item);
                }}
            >
                <span className="note-person-initial" aria-hidden="true">
                    {item.actor.displayName.slice(0, 1)}
                </span>
                <span className="note-notification-list__body">
                    <span className="note-notification-list__line" title={`${item.actor.displayName} ${kind.verb} «${item.note.title ?? "Nota sin título"}»`}>
                        <strong>{item.actor.displayName}</strong> {kind.verb} <em>«{item.note.title ?? "Nota sin título"}»</em>
                    </span>
                    {item.replyExcerpt && <q className="note-notification-list__quote">{item.replyExcerpt}</q>}
                    <time dateTime={item.createdAt}>{when(item.createdAt)}</time>
                </span>
            </button>
            {item.readAt === null && (
                <button
                    type="button"
                    className="note-notification-list__read"
                    aria-label="Marcar como leído"
                    title="Marcar como leído"
                    onClick={() => {
                        onMark(item.id);
                    }}
                >
                    <CheckOutlined aria-hidden="true" />
                </button>
            )}
        </li>
    );
}

function BellCount({ count, lower }: { readonly count: number | null; readonly lower: boolean }) {
    if (count === null || count === 0) return null;
    return (
        <span className="note-bell__count" aria-hidden="true">
            {count > 99 ? "99+" : `${String(count)}${lower ? "+" : ""}`}
        </span>
    );
}

function NotificationTools({ filter, hasData, onFilter, onMarkAll }: { readonly filter: "all" | "unread" | "mentions"; readonly hasData: boolean; readonly onFilter: (value: "all" | "unread" | "mentions") => void; readonly onMarkAll: () => void }) {
    return (
        <div className="note-notifications__tools">
            <label>
                Mostrar
                <select
                    aria-label="Filtrar notificaciones"
                    value={filter}
                    onChange={(e) => {
                        onFilter(e.target.value as typeof filter);
                    }}
                >
                    <option value="unread">No leídas</option>
                    <option value="all">Todas</option>
                    <option value="mentions">Menciones</option>
                </select>
            </label>
            <button
                type="button"
                disabled={!hasData}
                onClick={() => {
                    onMarkAll();
                }}
            >
                Marcar todas como leídas
            </button>
        </div>
    );
}

function NotificationPagination({ page, pagination, onPage }: { readonly page: number; readonly pagination: NoteNotifications["page"]; readonly onPage: (page: number) => void }) {
    return (
        <div className="note-pagination personal-notes-panel__pages">
            <button
                type="button"
                disabled={page === 1}
                onClick={() => {
                    onPage(page - 1);
                }}
            >
                Avisos anteriores
            </button>
            <span>Página {page}</span>
            <button
                type="button"
                disabled={page * pagination.size >= pagination.total}
                onClick={() => {
                    onPage(page + 1);
                }}
            >
                Avisos siguientes
            </button>
        </div>
    );
}
