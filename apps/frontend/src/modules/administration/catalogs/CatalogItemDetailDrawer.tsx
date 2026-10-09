/**
 * Detalle lateral de un valor de catálogo.
 *
 * Reutiliza el panel de usuarios. Editar y cambiar estado no se ejecutan aquí:
 * se delegan a la página, que pide el motivo de auditoría. Las flechas recorren
 * el listado salvo cuando el foco está en un campo o un menú.
 */
import "../components/UserDetailDrawer.css";

import AppstoreOutlined from "@ant-design/icons/AppstoreOutlined";
import EditOutlined from "@ant-design/icons/EditOutlined";
import LeftOutlined from "@ant-design/icons/LeftOutlined";
import ReloadOutlined from "@ant-design/icons/ReloadOutlined";
import RightOutlined from "@ant-design/icons/RightOutlined";
import StopOutlined from "@ant-design/icons/StopOutlined";
import Alert from "antd/es/alert";
import Button from "antd/es/button";
import Card from "antd/es/card";
import Descriptions from "antd/es/descriptions";
import Drawer from "antd/es/drawer";
import Skeleton from "antd/es/skeleton";
import Space from "antd/es/space";
import Tooltip from "antd/es/tooltip";
import Typography from "antd/es/typography";

import type { CatalogItem, CatalogItemStatus } from "../../../services/catalogs/catalog-service";
import { ADMINISTRATION_DRAWER_CLOSE_PLACEMENT, ADMINISTRATION_DRAWER_PROPS } from "../administration-theme";
import { SystemUserStatusBadge } from "../components/SystemUserBadges";
import { CATALOG_REFERENCE_PROVIDERS } from "./catalog-definitions";

/** Etiquetas de la referencia externa. Un estado desconocido se muestra tal cual. */
const REFERENCE_STATUS_LABELS: Readonly<Record<string, string>> = { active: "Activo", inactive: "Inactivo", pending: "Pendiente" };
/** Texto cuando el API no trae un dato. No se confunde con un valor guardado. */
const UNASSIGNED_VALUE = "Sin asignar";
/** Recorta el texto. Vacío o solo espacios se lee como no asignado. */
const displayValue = (value: string | null | undefined): string => value?.trim() || UNASSIGNED_VALUE;

/** Identificador copiable. Sin texto, no ofrece un botón de copiar vacío. */
function CatalogDetailIdentifier({ value }: { readonly value: string | null | undefined }) {
    const text = value?.trim();
    return text ? (
        <Typography.Text className="user-detail-drawer__public-id" code copyable>
            {text}
        </Typography.Text>
    ) : (
        <Typography.Text type="secondary">{UNASSIGNED_VALUE}</Typography.Text>
    );
}

/**
 * Referencias externas del valor.
 *
 * Si NetSuite u Odoo no tienen vínculo, se muestra la fila vacía. Esa fila no
 * se envía al API: solo explica que el sistema todavía no está asignado.
 */
function CatalogDetailReferences({ references, projectView }: { readonly references: CatalogItem["externalReferences"]; readonly projectView?: boolean }) {
    const missing = CATALOG_REFERENCE_PROVIDERS.filter((provider) => !references.some((reference) => reference.systemCode === provider.systemCode));
    const displayedReferences = [...references, ...missing.map((provider) => ({ ...provider, externalId: null, status: null }))];
    const providerCodes = [...new Set(displayedReferences.map((reference) => reference.systemCode))];
    return (
        <>
            {providerCodes.map((systemCode) => {
                const providerReferences = displayedReferences.filter((reference) => reference.systemCode === systemCode);
                return (
                    <Card size="small" key={systemCode} title={displayValue(providerReferences[0]?.systemName || systemCode)}>
                        <div className="user-detail-drawer__external-references">
                            {providerReferences.map((reference) => (
                                <Descriptions
                                    key={`${reference.systemCode}:${reference.externalId ?? "unassigned"}`}
                                    column={1}
                                    colon={false}
                                    size="small"
                                    layout="horizontal"
                                    items={[
                                        { key: "systemCode", label: "Código del sistema", children: displayValue(reference.systemCode) },
                                        { key: "id", label: "Identificador", children: <CatalogDetailIdentifier value={reference.externalId} /> },
                                        {
                                            key: "status",
                                            label: "Estado de referencia",
                                            children: projectView ? (
                                                <span className="projects-view-reference-status" data-status={reference.status ?? "unassigned"}>
                                                    {REFERENCE_STATUS_LABELS[reference.status ?? ""] ?? displayValue(reference.status)}
                                                </span>
                                            ) : (
                                                (REFERENCE_STATUS_LABELS[reference.status ?? ""] ?? displayValue(reference.status))
                                            ),
                                        },
                                    ]}
                                />
                            ))}
                        </div>
                    </Card>
                );
            })}
        </>
    );
}

/** Datos del valor abierto y las acciones que la página todavía tiene que confirmar. */
interface CatalogItemDetailDrawerProps {
    readonly projectView?: boolean;
    readonly catalogLabel: string;
    readonly error: string | null;
    readonly isLoading: boolean;
    readonly item: CatalogItem | null;
    readonly onClose: () => void;
    readonly onEdit: (item: CatalogItem) => void;
    readonly onRefresh: () => void;
    readonly onStatusAction: (item: CatalogItem, status: CatalogItemStatus) => void;
    readonly open: boolean;
    readonly position: number;
    readonly total: number;
    readonly onSelectPrevious: () => void;
    readonly onSelectNext: () => void;
}

/** Editar o cambiar estado. No se muestran mientras el detalle carga o falló. */
function CatalogDetailActions({ item, error, isLoading, onEdit, onStatusAction }: Pick<CatalogItemDetailDrawerProps, "item" | "error" | "isLoading" | "onEdit" | "onStatusAction">) {
    if (!item || error || isLoading) return null;
    const active = item.status === "active";
    return (
        <>
            <Button
                icon={<EditOutlined aria-hidden="true" />}
                onClick={() => {
                    onEdit(item);
                }}
            >
                Editar
            </Button>
            <Button
                type="primary"
                icon={active ? <StopOutlined aria-hidden="true" /> : <ReloadOutlined aria-hidden="true" />}
                onClick={() => {
                    onStatusAction(item, active ? "inactive" : "active");
                }}
            >
                {active ? "Inactivar" : "Reactivar"}
            </Button>
        </>
    );
}

/** Posición en el listado y acciones. Las flechas se deshabilitan en los extremos. */
function CatalogDetailFooter({ item, error, isLoading, onEdit, onStatusAction, position, total, onSelectPrevious, onSelectNext }: Omit<CatalogItemDetailDrawerProps, "catalogLabel" | "onClose" | "onRefresh" | "open">) {
    const unavailable = isLoading || Boolean(error);
    return (
        <div className="user-detail-drawer__footer">
            <Typography.Text type="secondary" className="user-detail-drawer__position">
                Registro {position} de {total}
            </Typography.Text>
            <Space size={8}>
                <Space.Compact>
                    <Tooltip title="Registro anterior (↑)">
                        <Button icon={<LeftOutlined aria-hidden="true" />} aria-label="Registro anterior" disabled={unavailable || position <= 1} onClick={onSelectPrevious} />
                    </Tooltip>
                    <Tooltip title="Registro siguiente (↓)">
                        <Button icon={<RightOutlined aria-hidden="true" />} aria-label="Registro siguiente" disabled={unavailable || position < 1 || position >= total} onClick={onSelectNext} />
                    </Tooltip>
                </Space.Compact>
                <CatalogDetailActions item={item} error={error} isLoading={isLoading} onEdit={onEdit} onStatusAction={onStatusAction} />
            </Space>
        </div>
    );
}

/** Projects uses sparse label/value lines; other catalogs keep their existing loader. */
function CatalogDetailLoading({ projectView }: { readonly projectView: boolean | undefined }) {
    return (
        <div role="status" aria-label="Cargando detalle" className={projectView ? "projects-view-detail-loading" : undefined}>
            {projectView ? (
                <div aria-hidden="true">
                    {Array.from({ length: 5 }, (_, index) => (
                        <div key={index} className="projects-view-detail-loading__pair">
                            <Skeleton.Node active className="projects-view-detail-loading__label" />
                            <Skeleton.Node active className="projects-view-detail-loading__value" />
                        </div>
                    ))}
                </div>
            ) : (
                <Skeleton active paragraph={{ rows: 8 }} />
            )}
        </div>
    );
}

/**
 * Panel de lectura de un valor.
 *
 * Las flechas del teclado cambian de registro. No actúan si el foco está en un
 * campo o en un menú, para no saltar de fila mientras se escribe.
 */
export function CatalogItemDetailDrawer({ projectView, catalogLabel, error, isLoading, item, onClose, onEdit, onRefresh, onStatusAction, open, position, total, onSelectPrevious, onSelectNext }: CatalogItemDetailDrawerProps) {
    return (
        <Drawer
            {...ADMINISTRATION_DRAWER_PROPS}
            rootClassName={["user-detail-drawer catalog-item-detail-drawer", projectView && "catalog-item-detail-drawer--projects"].filter(Boolean).join(" ")}
            closable={{ "aria-label": "Cerrar detalle", placement: ADMINISTRATION_DRAWER_CLOSE_PLACEMENT }}
            destroyOnHidden
            open={open}
            title={
                item ? (
                    <div className="user-detail-drawer__identity">
                        <span className="catalog-item-detail-drawer__avatar" aria-hidden="true">
                            <AppstoreOutlined />
                        </span>
                        <div className="user-detail-drawer__identity-copy">
                            <Typography.Title level={4}>{displayValue(item.name)}</Typography.Title>
                            <Typography.Text type="secondary" ellipsis={{ tooltip: catalogLabel }}>
                                {catalogLabel}
                            </Typography.Text>
                            <span className="user-detail-drawer__identity-meta">
                                <SystemUserStatusBadge status={item.status} />
                            </span>
                        </div>
                    </div>
                ) : (
                    `Detalle de ${catalogLabel}`
                )
            }
            onClose={onClose}
            styles={{ ...ADMINISTRATION_DRAWER_PROPS.styles, wrapper: { ...ADMINISTRATION_DRAWER_PROPS.styles.wrapper, maxWidth: "100vw" }, body: { minHeight: 0, overflowY: "auto", overscrollBehavior: "contain" } }}
            extra={
                <Tooltip title="Actualizar detalle" placement="bottom">
                    <Button className="user-detail-drawer__header-button" type="text" aria-label="Actualizar detalle" icon={<ReloadOutlined aria-hidden="true" />} disabled={isLoading} onClick={onRefresh} />
                </Tooltip>
            }
            footer={<CatalogDetailFooter item={item} error={error} isLoading={isLoading} onEdit={onEdit} onStatusAction={onStatusAction} position={position} total={total} onSelectPrevious={onSelectPrevious} onSelectNext={onSelectNext} />}
            onKeyDown={(event) => {
                if (isLoading || error || !item || (event.target as HTMLElement).closest("input, textarea, select, [role='menu'], [role='listbox'], .ant-dropdown")) return;
                if (event.key === "ArrowUp") {
                    event.preventDefault();
                    onSelectPrevious();
                }
                if (event.key === "ArrowDown") {
                    event.preventDefault();
                    onSelectNext();
                }
            }}
        >
            {isLoading ? (
                <CatalogDetailLoading projectView={projectView} />
            ) : error || !item ? (
                <Alert type="error" showIcon title={error ?? "Este registro ya no está disponible en el listado actual."} action={<Button onClick={onRefresh}>Reintentar</Button>} />
            ) : (
                <div className="user-detail-drawer__sections">
                    <Card size="small" title="Información del registro">
                        <Descriptions
                            column={1}
                            colon={false}
                            size="small"
                            layout="horizontal"
                            items={[
                                { key: "name", label: "Nombre", children: displayValue(item.name) },
                                { key: "detail", label: "Detalle", children: displayValue(item.detail) },
                            ]}
                        />
                    </Card>
                    <Card size="small" title="Registro">
                        <Descriptions
                            column={1}
                            colon={false}
                            size="small"
                            layout="horizontal"
                            items={[
                                {
                                    key: "publicId",
                                    label: "ID CRM",
                                    children: <CatalogDetailIdentifier value={item.publicId} />,
                                },
                                {
                                    key: "nativeCode",
                                    label: "Código nativo",
                                    children: <CatalogDetailIdentifier value={item.nativeCode} />,
                                },
                                { key: "updatedAt", label: "Última actualización", children: item.updatedAt.trim() ? <time dateTime={item.updatedAt}>{new Date(item.updatedAt).toLocaleString("es-CR")}</time> : UNASSIGNED_VALUE },
                            ]}
                        />
                    </Card>
                    <CatalogDetailReferences references={item.externalReferences} projectView={Boolean(projectView)} />
                </div>
            )}
        </Drawer>
    );
}
