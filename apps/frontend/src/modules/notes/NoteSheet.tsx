import CloseOutlined from "@ant-design/icons/CloseOutlined";
import EditOutlined from "@ant-design/icons/EditOutlined";
import PushpinOutlined from "@ant-design/icons/PushpinOutlined";
import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { NotePlacement, PersonalNote } from "../../services/notes/notes-service";
import { visiblePlacement } from "./note-placement";
import { NoteRelatedRecordsSummary } from "./NoteRelatedRecords";
import type { PlacementSaveState } from "./useNotePlacements";

const placementStatus: Record<PlacementSaveState, string> = { saving: "Guardando posición…", saved: "Guardada", error: "Posición sin confirmar" };

interface Props {
    readonly note: PersonalNote;
    readonly placement: NotePlacement;
    readonly busy: boolean;
    readonly onSave: (value: NotePlacement) => void;
    readonly onEdit: () => void;
    readonly saveState?: PlacementSaveState;
    readonly onRetry?: () => void;
}
/** Pointer movement is local; only pointer release or a keyboard action persists layout. */
export function NoteSheet({ note, placement, busy, onSave, onEdit, saveState, onRetry }: Props) {
    const [local, setLocal] = useState(() => visiblePlacement(placement));
    const current = useRef(local);
    const drag = useRef<{ x: number; y: number; base: NotePlacement; resize: boolean } | null>(null);
    useEffect(() => {
        if (drag.current || saveState === "saving" || saveState === "error") return;
        const value = visiblePlacement(placement);
        current.current = value;
        setLocal(value);
    }, [placement, saveState]);
    const set = (value: NotePlacement) => {
        current.current = value;
        setLocal(value);
    };
    const begin = (event: ReactPointerEvent<HTMLButtonElement>, resize: boolean) => {
        if (busy || event.button !== 0) return;
        event.preventDefault();
        drag.current = { x: event.clientX, y: event.clientY, base: current.current, resize };
        event.currentTarget.setPointerCapture(event.pointerId);
    };
    const move = (event: ReactPointerEvent<HTMLButtonElement>) => {
        const start = drag.current;
        if (!start) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        const value = start.resize ? { ...start.base, width: Math.round(Math.max(200, start.base.width + dx)), height: Math.round(Math.max(140, start.base.height + dy)) } : { ...start.base, x: start.base.x + dx, y: start.base.y + dy };
        set(visiblePlacement(value));
    };
    const finish = () => {
        if (!drag.current) return;
        drag.current = null;
        onSave(current.current);
    };
    const update = (value: NotePlacement) => {
        const bounded = visiblePlacement(value);
        set(bounded);
        onSave(bounded);
    };
    const title = note.title ?? "Sin título";
    const locked = busy || !note.capabilities.canMove;
    return createPortal(
        <article className="personal-note" aria-label={`Nota: ${title}`} style={{ position: local.anchorMode === "viewport" ? "fixed" : "absolute", left: local.x, top: local.y, width: local.width, height: local.collapsed ? 76 : local.height, backgroundColor: note.color }}>
            <header className="personal-note__bar">
                <button
                    type="button"
                    className="personal-note__move"
                    disabled={locked}
                    aria-label={`Mover nota ${title}`}
                    title="Arrastra o usa las flechas para mover"
                    onPointerDown={(e) => {
                        begin(e, false);
                    }}
                    onPointerMove={move}
                    onPointerUp={finish}
                    onPointerCancel={() => {
                        if (drag.current) set(drag.current.base);
                        drag.current = null;
                    }}
                    onKeyDown={(event) => {
                        const delta: Partial<Record<string, [number, number]>> = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] };
                        const d = delta[event.key];
                        if (!d) return;
                        event.preventDefault();
                        update({ ...local, x: local.x + d[0], y: local.y + d[1] });
                    }}
                >
                    ⠿ <span>{title}</span>
                </button>
                <button
                    type="button"
                    disabled={locked}
                    aria-label={`${local.anchorMode === "viewport" ? "Desfijar" : "Fijar"} nota ${title}`}
                    aria-pressed={local.anchorMode === "viewport"}
                    title="PIN: mantener fija al desplazarte"
                    onClick={() => {
                        update({ ...local, anchorMode: local.anchorMode === "viewport" ? "context" : "viewport", y: local.y + (local.anchorMode === "viewport" ? window.scrollY : -window.scrollY) });
                    }}
                >
                    <PushpinOutlined aria-hidden="true" />
                </button>
                <button
                    type="button"
                    aria-label={`Ocultar nota ${title}`}
                    disabled={locked}
                    title="Ocultar en la vista; sigue en Mis notas"
                    onClick={() => {
                        update({ ...local, hidden: true });
                    }}
                >
                    <CloseOutlined aria-hidden="true" />
                </button>
            </header>
            {!local.collapsed && (
                <>
                    <p className="personal-note__text">{note.content.text}</p>
                    <NoteRelatedRecordsSummary records={note.relatedRecords} compact />
                    <footer>
                        <button type="button" onClick={onEdit} aria-label={`Abrir nota ${title}`}>
                            <EditOutlined aria-hidden="true" /> Abrir
                        </button>
                        <span role="status">{placementStatus[saveState ?? "saved"]}</span>
                        <button type="button" hidden={saveState !== "error"} onClick={onRetry} aria-label={`Reintentar posición de nota ${title}`} title="No se pudo confirmar la posición. Reintenta sin duplicar la operación.">
                            Reintentar posición
                        </button>
                        <button
                            className="personal-note__resize"
                            type="button"
                            disabled={locked}
                            aria-label={`Cambiar tamaño de nota ${title}`}
                            title="Arrastra; con flechas cambia el tamaño"
                            onPointerDown={(e) => {
                                begin(e, true);
                            }}
                            onPointerMove={move}
                            onPointerUp={finish}
                            onPointerCancel={() => {
                                if (drag.current) set(drag.current.base);
                                drag.current = null;
                            }}
                            onKeyDown={(event) => {
                                const d: Partial<Record<string, [number, number]>> = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] };
                                const change = d[event.key];
                                if (!change) return;
                                event.preventDefault();
                                update({ ...local, width: Math.max(200, local.width + change[0]), height: Math.max(140, local.height + change[1]) });
                            }}
                        >
                            ◢
                        </button>
                    </footer>
                </>
            )}
        </article>,
        document.body,
    );
}
