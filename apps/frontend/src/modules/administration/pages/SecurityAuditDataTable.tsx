import "datatables.net-dt/css/dataTables.dataTables.css";
import "../catalogs/ProjectsView.css";

import EyeOutlined from "@ant-design/icons/EyeOutlined";
import Button from "antd/es/button";
import DT from "datatables.net-dt";
import DataTable from "datatables.net-react";

import { auditEventDescription } from "./audit-event-description";
import type { AuditEvent } from "./security-audit.api";
import { AuditActorRoles } from "./SecurityAuditActorRoles";
const registerDataTable = DataTable.use;
registerDataTable(DT);
const columns = [{ data: "actorName" }, { data: "recordedModule" }, { data: "record.id" }, { data: "actionLabel" }, { data: "createdAt" }, { data: "publicId" }];
const options = { paging: false, searching: false, ordering: false, autoWidth: false, info: false, layout: { topStart: null, topEnd: null, bottomStart: null, bottomEnd: null }, language: { emptyTable: "No hay eventos con esos filtros." } };
const text = (value: string | null) => value || "Sin asignar";
/** Catalog DataTable rendering; matching/order are authoritative on the server, not on one visible page. */
export function SecurityAuditDataTable({ items, onDetail }: { readonly items: AuditEvent[]; readonly onDetail: (publicId: string) => void }) {
    return (
        <div className="security-audit-grid catalog-items-page--projects">
            <DataTable
                data={items}
                columns={columns}
                options={options}
                slots={{
                    0: (_value: unknown, row: AuditEvent) => (
                        <div>
                            <strong>{text(row.actorName)}</strong>
                            <AuditActorRoles roles={row.actorRoles} />
                        </div>
                    ),
                    1: (_value: unknown, row: AuditEvent) => (
                        <div>
                            <strong>{row.moduleName ?? "Módulo no registrado"}</strong>
                            <small>{row.sectionName ?? "Sección no registrada"}</small>
                            {row.catalogName ? <small>{row.catalogName}</small> : null}
                            {!row.contextKnown ? <small>Contexto histórico no registrado</small> : null}
                        </div>
                    ),
                    2: (_value: unknown, row: AuditEvent) => (
                        <div>
                            <Button
                                type="link"
                                className="security-audit-record-button"
                                onClick={() => {
                                    onDetail(row.publicId);
                                }}
                            >
                                {row.record.name ?? "Registro sin nombre histórico"}
                            </Button>
                            <small>{row.record.id ?? "Referencia no registrada"}</small>
                        </div>
                    ),
                    3: (_value: unknown, row: AuditEvent) => (
                        <div>
                            <strong>{auditEventDescription(row)}</strong>
                            <small>{row.reason || "Sin motivo registrado"}</small>
                        </div>
                    ),
                    4: (_value: unknown, row: AuditEvent) => <time dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleString("es-CR")}</time>,
                    5: (_value: unknown, row: AuditEvent) => (
                        <Button
                            aria-label="Ver detalle"
                            title="Ver detalle"
                            icon={<EyeOutlined />}
                            onClick={() => {
                                onDetail(row.publicId);
                            }}
                        />
                    ),
                }}
            >
                <thead>
                    <tr>
                        {["Actor y roles", "Ubicación", "Registro", "Acción y motivo", "Fecha", "Detalle"].map((name) => (
                            <th key={name}>{name}</th>
                        ))}
                    </tr>
                </thead>
            </DataTable>
        </div>
    );
}
