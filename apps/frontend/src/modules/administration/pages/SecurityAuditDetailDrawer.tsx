import ReloadOutlined from "@ant-design/icons/ReloadOutlined";
import Button from "antd/es/button";
import Drawer from "antd/es/drawer";
import { useEffect, useState } from "react";

import { ADMINISTRATION_DRAWER_CLOSE_PLACEMENT, ADMINISTRATION_DRAWER_PROPS } from "../administration-theme";
import { ADMINISTRATION_CATALOGS } from "../catalogs/catalog-definitions";
import { auditEventDescription } from "./audit-event-description";
import { type AuditChangeSet, type AuditDetail, getAuditDetail } from "./security-audit.api";
import { AuditActorRoles } from "./SecurityAuditActorRoles";

const labels: Record<string, string> = {
    name: "Nombre",
    displayName: "Nombre visible",
    email: "Correo",
    detail: "Detalle",
    description: "Descripción",
    status: "Estado",
    deleted: "Eliminado",
    roleCodes: "Roles",
    orgUnitCodes: "Unidades organizativas",
    accessMethods: "Métodos de acceso",
    permissionCodes: "Permisos",
    permissionOverrides: "Excepciones de permisos",
    externalReferences: "Referencias externas",
    systemCode: "Sistema",
    externalId: "Identificador externo",
    externalUserId: "Usuario externo",
    externalUsername: "Nombre de usuario externo",
    permissionCode: "Permiso",
    code: "Código",
    effect: "Efecto",
};
const values: Record<string, string> = { active: "Activo", inactive: "Inactivo", allow: "Permitir", deny: "Denegar", local: "Local", microsoft: "Microsoft" };

function displayValue(value: unknown): string {
    if (value === null) return "Sin valor";
    switch (typeof value) {
        case "string":
            return values[value] ?? value;
        case "number":
            return String(value);
        case "boolean":
            return value ? "Sí" : "No";
        case "object":
            return displayCollection(value);
        default:
            return "Sin valor";
    }
}

function displayCollection(value: object): string {
    if (Array.isArray(value)) return value.length ? value.map(displayValue).join("; ") : "Sin asignar";
    return Object.entries(value)
        .map(([key, item]) => `${labels[key] ?? key}: ${displayValue(item)}`)
        .join(" · ");
}

/** A mounted drawer owns one read request; closing or switching events discards late responses. */
export function SecurityAuditDetailDrawer({ publicId, onClose }: { readonly publicId: string; readonly onClose: () => void }) {
    const [detail, setDetail] = useState<AuditDetail>();
    const [error, setError] = useState(false);
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        let live = true;
        getAuditDetail(publicId)
            .then((result) => {
                if (live) setDetail(result);
            })
            .catch(() => {
                if (live) setError(true);
            });
        return () => {
            live = false;
        };
    }, [publicId, attempt]);
    return (
        <Drawer {...ADMINISTRATION_DRAWER_PROPS} open title="Detalle de auditoría" onClose={onClose} closable={{ placement: ADMINISTRATION_DRAWER_CLOSE_PLACEMENT }} className="security-audit-detail">
            {error ? (
                <div role="alert">
                    No pudimos cargar el detalle.{" "}
                    <Button
                        aria-label="Reintentar"
                        icon={<ReloadOutlined />}
                        onClick={() => {
                            setError(false);
                            setAttempt((previous) => previous + 1);
                        }}
                    >
                        Reintentar
                    </Button>
                </div>
            ) : null}
            {!detail && !error ? <p role="status">Cargando detalle...</p> : null}
            {detail ? <AuditDetailContent detail={detail} /> : null}
        </Drawer>
    );
}

function AuditDetailContent({ detail }: { readonly detail: AuditDetail }) {
    const changeSet = detail.changeSet;
    return (
        <>
            <h2>{auditEventDescription(detail)}</h2>
            <dl>
                <dt>Actor</dt>
                <dd>{detail.actorName ?? "Sin asignar"}</dd>
                <dt>Identificador del actor</dt>
                <dd>{detail.actorPublicId ?? "No registrado"}</dd>
                <dt>Roles históricos</dt>
                <dd>
                    <AuditActorRoles roles={detail.actorRoles} />
                </dd>
                <dt>Usuario afectado</dt>
                <dd>{detail.targetName ?? "Sin asignar"}</dd>
                <dt>Fecha</dt>
                <dd>{new Date(detail.createdAt).toLocaleString("es-CR")}</dd>
                <dt>Motivo</dt>
                <dd>{detail.reason ?? "Sin motivo registrado"}</dd>
                <dt>Acción</dt>
                <dd>{detail.actionLabel}</dd>
            </dl>
            <AuditRecordReference detail={detail} />
            {!changeSet ? <p>Este evento histórico no tiene comparación registrada.</p> : <AuditComparison changeSet={changeSet} />}
        </>
    );
}

function AuditRecordReference({ detail }: { readonly detail: AuditDetail }) {
    const path = auditSectionPath(detail);
    return (
        <section aria-label="Referencia histórica">
            <h3>Referencia del registro</h3>
            <AuditReferenceFacts detail={detail} />
            {path ? <a href={path}>Abrir sección</a> : null}
        </section>
    );
}

const entityLabel = (entity: string | null): string => ({ catalog: "Catálogo", user: "Usuario", role: "Rol" })[entity ?? ""] ?? "Entidad no registrada";

function AuditReferenceFacts({ detail }: { readonly detail: AuditDetail }) {
    return (
        <dl>
            <dt>Módulo</dt>
            <dd>{detail.moduleName ?? "No registrado"}</dd>
            <dt>Sección</dt>
            <dd>{detail.sectionName ?? "No registrada"}</dd>
            <dt>Catálogo</dt>
            <dd>{detail.catalogName ?? "No registrado"}</dd>
            <dt>Entidad</dt>
            <dd>{entityLabel(detail.record.entity)}</dd>
            <dt>Nombre histórico</dt>
            <dd>{detail.record.name ?? "No registrado"}</dd>
            <dt>Identificador</dt>
            <dd>{detail.record.id ?? "No registrado"}</dd>
        </dl>
    );
}

/** Only existing guarded section routes are linked; this is never a URL for a specific record. */
function auditSectionPath(detail: AuditDetail): string | null {
    if (!detail.contextKnown) return null;
    const workspaces: Readonly<Record<string, string>> = { administration: "administration", ventas: "sales", mercadeo: "marketing", formalizacion: "formalization", contabilidad: "accounting" };
    const workspace = workspaces[String(detail.recordedModule)];
    if (!workspace) return null;
    if (detail.recordedSection === "catalogs") {
        const catalog = ADMINISTRATION_CATALOGS.find((item) => item.code === detail.catalogCode);
        return catalog ? `/home/${workspace}/catalogs/${catalog.code}` : null;
    }
    const identitySections: Readonly<Record<string, string>> = { users: "/home/administration/users", roles: "/home/administration/roles-security" };
    return workspace === "administration" ? (identitySections[String(detail.recordedSection)] ?? null) : null;
}

function AuditComparison({ changeSet }: { readonly changeSet: AuditChangeSet }) {
    const rows = changeSet.action === "create" ? Object.entries(changeSet.after ?? {}).map(([field, after]) => ({ field, before: null, after })) : changeSet.changes;
    return (
        <>
            <h3>{changeSet.action === "create" ? "Datos registrados al crear" : "Cambios registrados"}</h3>
            {rows.length ? (
                <div className="security-audit-detail-scroll">
                    <table aria-label="Comparación de campos">
                        <thead>
                            <tr>
                                <th>Campo</th>
                                <th>Anterior</th>
                                <th>Actual</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr key={row.field}>
                                    <th scope="row">{labels[row.field] ?? row.field}</th>
                                    <td>{displayValue(row.before)}</td>
                                    <td>{displayValue(row.after)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p>Sin cambios de campos registrados.</p>
            )}
        </>
    );
}
