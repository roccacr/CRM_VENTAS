import "./SecurityAuditPage.css";

import SearchOutlined from "@ant-design/icons/SearchOutlined";
import { useEffect, useMemo, useState } from "react";

import { getIdentitySecurityCatalog } from "../../../services/auth/auth-service";
import type { IdentitySecurityAuditItem, IdentityUser } from "../../../services/auth/identity-contracts";

interface AuditOption {
    readonly code: string;
    readonly name: string;
}

const formatAuditDate = (value: string): string => new Date(value).toLocaleString("es-CR");

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : "No se pudo cargar la auditoría.");

const formatRoleScope = (roleCode: string | null, roleNameByCode: ReadonlyMap<string, string>): string => {
    if (!roleCode) {
        return "Sin rol específico";
    }

    return roleCode
        .split(", ")
        .map((code) => roleNameByCode.get(code) ?? code)
        .join(", ");
};

const matchesFilter = (event: IdentitySecurityAuditItem, query: string): boolean => {
    if (!query) {
        return true;
    }

    return [event.actorName, event.eventType, event.reason, event.roleCode, event.summary, event.targetName, ...event.moduleCodes].filter(Boolean).join(" ").toLowerCase().includes(query);
};

/** Vista operativa de respaldo para cambios de roles, modulos y permisos. */
export function SecurityAuditPage({ currentUser: _currentUser }: { readonly currentUser: IdentityUser }) {
    const [events, setEvents] = useState<readonly IdentitySecurityAuditItem[]>([]);
    const [modules, setModules] = useState<readonly AuditOption[]>([]);
    const [roles, setRoles] = useState<readonly AuditOption[]>([]);
    const [moduleFilter, setModuleFilter] = useState("");
    const [query, setQuery] = useState("");
    const [roleFilter, setRoleFilter] = useState("");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        getIdentitySecurityCatalog()
            .then((catalog) => {
                if (cancelled) {
                    return;
                }

                setEvents(catalog.auditEvents);
                setModules(catalog.modules.map((module) => ({ code: module.code, name: module.name })));
                setRoles(catalog.roles.map((role) => ({ code: role.code, name: role.name })));
                setErrorMessage(null);
            })
            .catch((error: unknown) => {
                if (!cancelled) {
                    setErrorMessage(getErrorMessage(error));
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setIsLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const moduleNameByCode = useMemo(() => new Map(modules.map((module) => [module.code, module.name])), [modules]);
    const roleNameByCode = useMemo(() => new Map(roles.map((role) => [role.code, role.name])), [roles]);
    const normalizedQuery = query.trim().toLowerCase();
    const filteredEvents = useMemo(
        () =>
            events.filter((event) => {
                const matchesModule = !moduleFilter || event.moduleCodes.includes(moduleFilter);
                const matchesRole = !roleFilter || event.roleCode === roleFilter || event.roleCode?.split(", ").includes(roleFilter);

                return matchesModule && matchesRole && matchesFilter(event, normalizedQuery);
            }),
        [events, moduleFilter, normalizedQuery, roleFilter],
    );

    return (
        <div className="security-audit-page">
            <section className="security-audit-header" aria-labelledby="security-audit-title">
                <div>
                    <span>Administración / Auditoría</span>
                    <h1 id="security-audit-title">Auditoría de roles y permisos</h1>
                    <p>Consulta quién cambió roles, módulos y permisos, con motivo auditable.</p>
                </div>
            </section>

            <section className="security-audit-toolbar" aria-label="Filtros de auditoría">
                <label className="security-audit-search">
                    <SearchOutlined />
                    <input
                        placeholder="Buscar actor, usuario, motivo o evento"
                        value={query}
                        onChange={(event) => {
                            setQuery(event.target.value);
                        }}
                    />
                </label>
                <select
                    aria-label="Filtrar por módulo"
                    value={moduleFilter}
                    onChange={(event) => {
                        setModuleFilter(event.target.value);
                    }}
                >
                    <option value="">Todos los módulos</option>
                    {modules.map((module) => (
                        <option key={module.code} value={module.code}>
                            {module.name}
                        </option>
                    ))}
                </select>
                <select
                    aria-label="Filtrar por rol"
                    value={roleFilter}
                    onChange={(event) => {
                        setRoleFilter(event.target.value);
                    }}
                >
                    <option value="">Todos los roles</option>
                    {roles.map((role) => (
                        <option key={role.code} value={role.code}>
                            {role.name}
                        </option>
                    ))}
                </select>
            </section>

            <section className="security-audit-table" aria-label="Eventos auditados">
                <header>
                    <span>Evento</span>
                    <span>Actor</span>
                    <span>Alcance</span>
                    <span>Fecha</span>
                </header>
                {isLoading ? (
                    <div className="security-audit-state">Cargando auditoría...</div>
                ) : errorMessage ? (
                    <div className="security-audit-state security-audit-state--error">{errorMessage}</div>
                ) : filteredEvents.length > 0 ? (
                    filteredEvents.map((event) => (
                        <article className="security-audit-row" key={event.publicId}>
                            <div>
                                <strong>{event.summary}</strong>
                                <small>{event.reason ?? "Sin motivo registrado"}</small>
                            </div>
                            <div>
                                <strong>{event.actorName ?? "Sistema"}</strong>
                                <small>{event.targetName ?? "Cambio sobre rol base"}</small>
                            </div>
                            <div>
                                <strong>{formatRoleScope(event.roleCode, roleNameByCode)}</strong>
                                <small>{event.moduleCodes.length > 0 ? event.moduleCodes.map((code) => moduleNameByCode.get(code) ?? code).join(", ") : "Sin módulo específico"}</small>
                            </div>
                            <time dateTime={event.createdAt}>{formatAuditDate(event.createdAt)}</time>
                        </article>
                    ))
                ) : (
                    <div className="security-audit-state">No hay eventos con esos filtros.</div>
                )}
            </section>
        </div>
    );
}
