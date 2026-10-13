/** Criteria-first audit history; reads only the selected module/section batch. */
import "./SecurityAuditPage.css";

import LeftOutlined from "@ant-design/icons/LeftOutlined";
import ReloadOutlined from "@ant-design/icons/ReloadOutlined";
import RightOutlined from "@ant-design/icons/RightOutlined";
import SearchOutlined from "@ant-design/icons/SearchOutlined";
import Button from "antd/es/button";
import ConfigProvider from "antd/es/config-provider";
import Input from "antd/es/input";
import Select from "antd/es/select";
import { useEffect, useRef, useState } from "react";

import type { IdentityUser } from "../../../services/auth/identity-contracts";
import { PROJECTS_THEME } from "../catalogs/projects-theme";
import { type AuditFilter, type AuditOptions, type AuditPage, getAuditOptions, getAuditPage } from "./security-audit.api";
import { SecurityAuditDataTable } from "./SecurityAuditDataTable";
import { SecurityAuditDetailDrawer } from "./SecurityAuditDetailDrawer";

/** Session-owned caches are memory-only and expire; no log data enters localStorage. */
export function SecurityAuditPage({ currentUser }: { readonly currentUser: IdentityUser }) {
    return (
        <ConfigProvider theme={PROJECTS_THEME}>
            <AuditContent key={currentUser.publicId} />
        </ConfigProvider>
    );
}
// Loading, independent primary filters and bounded pagination are separate UI states.
// eslint-disable-next-line complexity
function AuditContent() {
    const [options, setOptions] = useState<AuditOptions>();
    const [detailId, setDetailId] = useState<string>();
    const [moduleCode, setModule] = useState("");
    const [sectionCode, setSection] = useState("");
    const [catalogCode, setCatalog] = useState<string>();
    const [search, setSearch] = useState("");
    const [limit, setLimit] = useState(100);
    const [active, setActive] = useState<AuditFilter>();
    const [page, setPage] = useState<AuditPage>();
    const [index, setIndex] = useState(0);
    const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const sequence = useRef(0);
    const cache = useRef(new Map<string, { at: number; page: AuditPage }>());
    useEffect(() => {
        let live = true;
        getAuditOptions()
            .then((result) => {
                if (live) setOptions(result);
            })
            .catch(() => {
                if (live) setError("No pudimos cargar los módulos de auditoría.");
            });
        return () => {
            live = false;
            // Request ownership, not a DOM ref: invalidate the latest in-flight request on unmount.
            // eslint-disable-next-line react-hooks/exhaustive-deps
            sequence.current++;
        };
    }, []);
    function clearView() {
        setDetailId(undefined);
        sequence.current++;
        setPage(undefined);
        setActive(undefined);
        setBusy(false);
        setError("");
        setIndex(0);
        setCursors([undefined]);
    }
    // Cache freshness, eviction, request ownership and failure/loading states are independent.
    // eslint-disable-next-line complexity
    async function load(filter: AuditFilter, nextIndex: number, history: (string | undefined)[], refresh = false) {
        const request = ++sequence.current;
        if (refresh) cache.current.clear();
        const key = JSON.stringify(filter);
        const cached = cache.current.get(key);
        const reusable = cached && Date.now() - cached.at < 30_000;
        setError("");
        setBusy(!reusable);
        try {
            const result = reusable ? cached.page : await getAuditPage(filter);
            if (request !== sequence.current) return;
            cache.current.delete(key);
            cache.current.set(key, { at: Date.now(), page: result });
            if (cache.current.size > 20) {
                const oldest = cache.current.keys().next().value;
                if (oldest !== undefined) cache.current.delete(oldest);
            }
            setActive(filter);
            setPage(result);
            setIndex(nextIndex);
            setCursors(history);
        } catch {
            if (request === sequence.current) setError("No pudimos cargar esta página de auditoría. Intenta nuevamente.");
        } finally {
            if (request === sequence.current) setBusy(false);
        }
    }
    const module = options?.modules.find((item) => item.code === moduleCode);
    return (
        <div className="security-audit-page">
            <header className="security-audit-header">
                <div>
                    <span>Administración / Auditoría</span>
                    <h1>Auditoría</h1>
                    <p>Consulta de eventos por módulo y sección.</p>
                </div>
                <Button
                    aria-label="Actualizar auditoría"
                    title="Actualizar auditoría"
                    icon={<ReloadOutlined />}
                    disabled={!active || busy}
                    onClick={() => {
                        if (active) void load({ ...active, cursor: undefined }, 0, [undefined], true);
                    }}
                />
            </header>
            <form
                className="security-audit-toolbar"
                onSubmit={(event) => {
                    event.preventDefault();
                    if (moduleCode && sectionCode && !busy) void load({ moduleCode, sectionCode, limit, ...(sectionCode === "catalogs" && catalogCode ? { catalogCode } : {}), ...(search.trim() ? { search: search.trim() } : {}) }, 0, [undefined]);
                }}
            >
                <label>
                    Módulo
                    <Select<string>
                        aria-label="Módulo de auditoría"
                        placeholder="Seleccionar módulo"
                        value={moduleCode || null}
                        options={(options?.modules ?? []).map((item) => ({ value: item.code, label: item.name }))}
                        onChange={(value) => {
                            setModule(value);
                            setSection("");
                            setCatalog(undefined);
                            clearView();
                        }}
                    />
                </label>
                <label>
                    Sección
                    <Select<string>
                        aria-label="Sección de auditoría"
                        placeholder="Seleccionar sección"
                        disabled={!module}
                        value={sectionCode || null}
                        options={(module?.sections ?? []).map((item) => ({ value: item.code, label: item.name }))}
                        onChange={(value) => {
                            setSection(value);
                            setCatalog(undefined);
                            clearView();
                        }}
                    />
                </label>
                {sectionCode === "catalogs" ? (
                    <label>
                        Catálogo
                        <Select<string>
                            aria-label="Catálogo de auditoría"
                            placeholder="Todos los catálogos"
                            allowClear
                            value={catalogCode ?? null}
                            options={(options?.catalogs ?? []).map((item) => ({ value: item.code, label: item.name }))}
                            onChange={(value) => {
                                setCatalog(value);
                                clearView();
                            }}
                        />
                    </label>
                ) : null}
                <label>
                    Buscar
                    <Input
                        aria-label="Buscar en auditoría"
                        placeholder="Actor, usuario, motivo o evento"
                        value={search}
                        maxLength={100}
                        onChange={(event) => {
                            setSearch(event.target.value);
                        }}
                    />
                </label>
                <Button aria-label="Buscar eventos" type="primary" htmlType="submit" icon={<SearchOutlined />} disabled={!moduleCode || !sectionCode || busy}>
                    Buscar eventos
                </Button>
            </form>
            {error ? (
                <p role="alert" className="security-audit-state--error">
                    {error}
                </p>
            ) : null}
            <section className="security-audit-results" aria-label="Eventos auditados" aria-busy={busy}>
                {page ? <SecurityAuditDataTable items={page.items} onDetail={setDetailId} /> : <div className="security-audit-state">Selecciona un módulo y una sección.</div>}
                {busy ? (
                    <div className="security-audit-progress" role="status">
                        <ReloadOutlined spin /> Cargando auditoría...
                    </div>
                ) : null}
            </section>
            {detailId ? (
                <SecurityAuditDetailDrawer
                    key={detailId}
                    publicId={detailId}
                    onClose={() => {
                        setDetailId(undefined);
                    }}
                />
            ) : null}
            <footer className="security-audit-pagination">
                <span>{page ? `${String(page.items.length)} eventos · Página ${String(index + 1)}` : "0 eventos"}</span>
                <Select
                    aria-label="Filas por página"
                    value={limit}
                    disabled={busy}
                    options={[10, 50, 100, 200].map((value) => ({ value, label: String(value) }))}
                    onChange={(value) => {
                        setLimit(value);
                        if (active) void load({ ...active, limit: value, cursor: undefined }, 0, [undefined]);
                    }}
                />
                <Button
                    aria-label="Página anterior"
                    icon={<LeftOutlined />}
                    disabled={!active || busy || index === 0}
                    onClick={() => {
                        if (active) void load({ ...active, cursor: cursors[index - 1] }, index - 1, cursors);
                    }}
                />
                <Button
                    aria-label="Página siguiente"
                    icon={<RightOutlined />}
                    disabled={!active || busy || !page?.pagination.hasNext}
                    onClick={() => {
                        if (active && page?.pagination.nextCursor) void load({ ...active, cursor: page.pagination.nextCursor }, index + 1, [...cursors.slice(0, index + 1), page.pagination.nextCursor]);
                    }}
                />
            </footer>
        </div>
    );
}
