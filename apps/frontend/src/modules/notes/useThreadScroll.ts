import { useLayoutEffect, useRef, useState } from "react";

import type { NoteThread } from "../../services/notes/note-collaboration-service";

const BOTTOM_DISTANCE = 48;
/** Sigue al dueño del scroll del panel. Conserva la posición de lectura anterior y no mueve el foco del teclado. */
export function useThreadScroll(thread: NoteThread | null, page: number, open: boolean, onFollowLatest: (page: number) => void) {
    const replyKey = thread?.replies.map((reply) => reply.id).join("|") ?? "";
    const total = thread?.replyPage.total ?? 0;
    const snapshotPage = thread?.replyPage.number ?? 0;
    const latestPage = thread ? Math.max(1, Math.ceil(total / thread.replyPage.size)) : 1;
    const followLatest = useRef(onFollowLatest);
    useLayoutEffect(() => {
        followLatest.current = onFollowLatest;
    }, [onFollowLatest]);
    const contentRef = useRef<HTMLDivElement>(null);
    const bottom = useRef(true);
    const previous = useRef<{ key: string; page: number; total: number } | null>(null);
    const [hasNewReplies, setHasNewReplies] = useState(false);
    useLayoutEffect(() => {
        const body = contentRef.current?.closest<HTMLElement>(".ant-drawer-body");
        if (!body || !open) return;
        const scroll = () => {
            bottom.current = body.scrollHeight - body.clientHeight - body.scrollTop <= BOTTOM_DISTANCE;
            if (bottom.current) setHasNewReplies(false);
        };
        body.addEventListener("scroll", scroll, { passive: true });
        return () => {
            body.removeEventListener("scroll", scroll);
        };
    }, [open]);
    useLayoutEffect(() => {
        const body = contentRef.current?.closest<HTMLElement>(".ant-drawer-body");
        if (!body || !open) return;
        if (snapshotPage !== page) return;
        const old = previous.current;
        const current = { key: replyKey, page, total };
        previous.current = current;
        if (!newReplyArrived(old, current)) {
            if (bottom.current) body.scrollTop = body.scrollHeight;
            return;
        }
        if (bottom.current) {
            body.scrollTop = body.scrollHeight;
            void Promise.resolve().then(() => {
                followLatest.current(latestPage);
            });
            return;
        }
        let active = true;
        void Promise.resolve().then(() => {
            if (active) setHasNewReplies(true);
        });
        return () => {
            active = false;
        };
    }, [replyKey, page, open, total, latestPage, snapshotPage]);
    const jumpToLatest = () => {
        const body = contentRef.current?.closest<HTMLElement>(".ant-drawer-body");
        if (body) body.scrollTop = body.scrollHeight;
        bottom.current = true;
        setHasNewReplies(false);
    };
    return { contentRef, hasNewReplies, jumpToLatest };
}

function newReplyArrived(old: { key: string; page: number; total: number } | null, current: { key: string; page: number; total: number }): boolean {
    if (!current.key) return false;
    if (!old) return true;
    if (old.page !== current.page) return false;
    if (current.total > old.total) return true;
    const oldIds = new Set(old.key.split("|"));
    return current.key.split("|").some((id) => !oldIds.has(id));
}
