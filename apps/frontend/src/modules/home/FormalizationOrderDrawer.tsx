/** Canonical order detail with a permission-gated stage editor. Outlook opens a draft only; it never sends mail or changes stage. */
import "../administration/components/UserDetailDrawer.css";
import "../administration/catalogs/CatalogItemsPage.css";
import "../administration/catalogs/ProjectsView.css";
import "../administration/catalogs/EnterpriseSurface.css";

import FileTextOutlined from "@ant-design/icons/FileTextOutlined";
import LeftOutlined from "@ant-design/icons/LeftOutlined";
import MailOutlined from "@ant-design/icons/MailOutlined";
import RightOutlined from "@ant-design/icons/RightOutlined";
import Button from "antd/es/button";
import Card from "antd/es/card";
import Descriptions from "antd/es/descriptions";
import Drawer from "antd/es/drawer";
import Space from "antd/es/space";
import Tooltip from "antd/es/tooltip";
import Typography from "antd/es/typography";

import type { FollowUpItem } from "../../services/formalization/follow-up-service";
import { ADMINISTRATION_DRAWER_CLOSE_PLACEMENT, ADMINISTRATION_DRAWER_PROPS } from "../administration/administration-theme";
import { FormalizationRecordProgress } from "./FormalizationRecordProgress";
import { StageChip } from "./FormalizationStageChip";
import { FormalizationStageEditor } from "./FormalizationStageEditor";

/** Text when the API has no value. Shown quiet so it is never mistaken for a saved value. */
const MISSING = "Sin dato";
const ORIGIN_LABELS: Readonly<Record<FollowUpItem["source"], string>> = { native: "CRM", legacy: "Sistema anterior" };

function Value({ children }: { readonly children: string | null | undefined }) {
    return children?.trim() ? <>{children.trim()}</> : <Typography.Text type="secondary">{MISSING}</Typography.Text>;
}

const rows = (items: readonly { readonly key: string; readonly label: string; readonly value: React.ReactNode }[]) => items.map(({ key, label, value }) => ({ key, label, children: value }));

function Section({ title, items }: { readonly title: string; readonly items: readonly { readonly key: string; readonly label: string; readonly value: React.ReactNode }[] }) {
    return (
        <Card size="small" title={title}>
            <Descriptions column={1} colon={false} size="small" layout="horizontal" items={rows(items)} />
        </Card>
    );
}

function timeInStage(days: number | null): string | null {
    return days === null ? null : `${String(days)} ${days === 1 ? "día" : "días"} en la etapa`;
}

interface Props {
    readonly stagePermissions?: readonly { code: string; effect: string }[] | undefined;
    readonly canUpdateStage?: boolean;
    readonly onViewFull?: () => void;
    readonly onStageSaved?: () => void | Promise<void>;
    readonly onRefreshOrder?: () => void;
    readonly item: FollowUpItem | null;
    readonly position: number;
    readonly total: number;
    readonly onClose: () => void;
    readonly onSelectPrevious: () => void;
    readonly onSelectNext: () => void;
}

function OrderFooter({ position, total, onSelectPrevious, onSelectNext }: Omit<Props, "item" | "onClose">) {
    return (
        <div className="user-detail-drawer__footer">
            <Typography.Text type="secondary" className="user-detail-drawer__position">
                {position > 0 ? `Orden ${String(position)} de ${String(total)}` : "Orden abierta fuera de la bandeja actual"}
            </Typography.Text>
            <Space.Compact>
                <Tooltip title="Orden anterior (↑)">
                    <Button icon={<LeftOutlined aria-hidden="true" />} aria-label="Orden anterior" disabled={position <= 1} onClick={onSelectPrevious} />
                </Tooltip>
                <Tooltip title="Orden siguiente (↓)">
                    <Button icon={<RightOutlined aria-hidden="true" />} aria-label="Orden siguiente" disabled={position < 1 || position >= total} onClick={onSelectNext} />
                </Tooltip>
            </Space.Compact>
        </div>
    );
}

/**
 *
 */
function OrderTitle({ item }: { readonly item: FollowUpItem | null }) {
    if (!item) return <>Detalle de la orden</>;
    return (
        <div className="user-detail-drawer__identity">
            <span className="catalog-item-detail-drawer__avatar" aria-hidden="true">
                <FileTextOutlined />
            </span>
            <div className="user-detail-drawer__identity-copy">
                <Typography.Title level={4}>{item.number}</Typography.Title>
                <Typography.Text type="secondary" ellipsis={{ tooltip: item.client ?? "Sin cliente" }}>
                    {item.client ?? "Sin cliente"}
                </Typography.Text>
                <span className="user-detail-drawer__identity-meta">
                    <StageChip label={item.state.label} />
                </span>
            </div>
        </div>
    );
}

/** Opens a draft without sending mail or registering a contract transition. */
export function OutlookCompose({ item }: { readonly item: FollowUpItem }) {
    if (item.state.code !== "contract_pending_send") return null;
    return (
        <Card size="small" title="Envío del contrato" className="formalization-contract-send">
            {item.clientEmail ? (
                <Space orientation="vertical">
                    <span className="formalization-contract-send__label">Correo del cliente</span>
                    <Typography.Text className="formalization-contract-send__email">{item.clientEmail}</Typography.Text>
                    <Button icon={<MailOutlined aria-hidden="true" />} href={`https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(item.clientEmail)}`} target="_blank" rel="noopener noreferrer">
                        Abrir Outlook
                    </Button>
                </Space>
            ) : (
                <Typography.Text type="secondary">Correo del cliente no disponible</Typography.Text>
            )}
        </Card>
    );
}

/** Up/Down walk the page unless the focus is in a field or menu, so typing never jumps rows. */
function walkWithArrows(event: React.KeyboardEvent, previous: () => void, next: () => void) {
    if ((event.target as HTMLElement).closest("input, textarea, select, [role='menu'], [role='listbox'], .ant-dropdown")) return;
    if (event.key === "ArrowUp") {
        event.preventDefault();
        previous();
    }
    if (event.key === "ArrowDown") {
        event.preventDefault();
        next();
    }
}

/**
 *
 */
export function FormalizationOrderDrawer({ item, position, total, onClose, onSelectPrevious, onSelectNext, canUpdateStage = false, stagePermissions = [], onStageSaved, onRefreshOrder, onViewFull }: Props) {
    return (
        <Drawer
            {...ADMINISTRATION_DRAWER_PROPS}
            rootClassName="user-detail-drawer catalog-item-detail-drawer catalog-item-detail-drawer--projects"
            closable={{ "aria-label": "Cerrar detalle de la orden", placement: ADMINISTRATION_DRAWER_CLOSE_PLACEMENT }}
            destroyOnHidden
            open={item !== null}
            title={<OrderTitle item={item} />}
            styles={{ ...ADMINISTRATION_DRAWER_PROPS.styles, wrapper: { ...ADMINISTRATION_DRAWER_PROPS.styles.wrapper, maxWidth: "100vw" }, body: { minHeight: 0, overflowY: "auto", overscrollBehavior: "contain" } }}
            footer={<OrderFooter position={position} total={total} onSelectPrevious={onSelectPrevious} onSelectNext={onSelectNext} />}
            onClose={onClose}
            onKeyDown={(event) => {
                walkWithArrows(event, onSelectPrevious, onSelectNext);
            }}
        >
            {item && (
                <div className="user-detail-drawer__sections">
                    <Button className="formalization-view-full" icon={<FileTextOutlined aria-hidden="true" />} onClick={onViewFull}>
                        Ver orden completa
                    </Button>
                    <FormalizationRecordProgress state={item.state.code} compact />
                    <FormalizationStageEditor
                        key={`${item.source}:${item.id}:${String(item.stateVersion)}:${item.state.code}`}
                        item={item}
                        allowed={canUpdateStage}
                        permissions={stagePermissions}
                        onSaved={() => onStageSaved?.()}
                        onRefresh={() => {
                            onClose();
                            onRefreshOrder?.();
                        }}
                    />
                    <OutlookCompose item={item} />
                    <Section
                        title="Cliente y unidad"
                        items={[
                            { key: "client", label: "Cliente", value: <Value>{item.client}</Value> },
                            { key: "project", label: "Proyecto", value: <Value>{item.project?.name}</Value> },
                            { key: "unit", label: "Unidad", value: <Value>{item.unit}</Value> },
                        ]}
                    />
                    <Section
                        title="Seguimiento"
                        items={[
                            { key: "stage", label: "Etapa", value: <StageChip label={item.state.label} /> },
                            { key: "time", label: "Tiempo", value: <Value>{timeInStage(item.state.days)}</Value> },
                            { key: "responsible", label: "Responsable", value: <Value>{item.responsible?.name}</Value> },
                            { key: "seller", label: "Vendedor", value: <Value>{item.seller?.name}</Value> },
                            { key: "next", label: "Siguiente paso", value: <Value>{item.nextStep}</Value> },
                        ]}
                    />
                    <Section
                        title="Registro"
                        items={[
                            { key: "number", label: "Orden de venta", value: <Typography.Text code>{item.number}</Typography.Text> },
                            { key: "origin", label: "Origen", value: ORIGIN_LABELS[item.source] },
                            { key: "changedBy", label: "Último cambio por", value: <Value>{item.changedBy?.name}</Value> },
                        ]}
                    />
                </div>
            )}
        </Drawer>
    );
}
