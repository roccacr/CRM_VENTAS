import { useEffect, useState } from "react";

import { type FiniquitoOverview, type FiniquitoSection, getFiniquitoOverview } from "../../services/formalization/finiquito-service";

/** La página y los cuatro contadores se leen del mismo endpoint; una respuesta vieja no reemplaza otra selección. */
export function useFiniquitoBanner(enabled: boolean, refreshVersion: number) {
    const [response, setResponse] = useState<{ key: string; data: FiniquitoOverview | null; failed: boolean } | null>(null);
    const [open, setOpen] = useState(false);
    const [section, setSection] = useState<FiniquitoSection | "all">("all");
    const [page, setPage] = useState(1);
    const [revision, setRevision] = useState(0);
    const key = `${String(refreshVersion)}:${section}:${String(page)}:${String(revision)}`;
    useEffect(() => {
        if (!enabled) return;
        let active = true;
        void getFiniquitoOverview(section, page)
            .then((result) => {
                if (active) setResponse({ key, data: result, failed: false });
            })
            .catch(() => {
                if (active) setResponse({ key, data: null, failed: true });
            });
        return () => {
            active = false;
        };
    }, [enabled, key, section, page]);
    const current = response?.key === key ? response : null;
    return {
        data: current?.data ?? null,
        failed: current?.failed ?? false,
        busy: enabled && current === null,
        open,
        section,
        page,
        setPage,
        close: () => {
            setOpen(false);
        },
        retry: () => {
            setRevision((value) => value + 1);
        },
        select: (value: FiniquitoSection | "all") => {
            setSection(value);
            setPage(1);
            setOpen(true);
        },
    };
}
