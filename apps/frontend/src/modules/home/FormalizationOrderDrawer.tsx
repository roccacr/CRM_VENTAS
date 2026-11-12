/** Detalle canónico de la orden, con el editor de etapa detrás de su permiso. Outlook abre solo un borrador: no envía correo ni cambia la etapa. */
import "../administration/components/UserDetailDrawer.css";
import "../administration/catalogs/CatalogItemsPage.css";
import "../administration/catalogs/ProjectsView.css";
import "../administration/catalogs/EnterpriseSurface.css";
import "./FormalizationOrderDrawer.css";

import FileTextOutlined from "@ant-design/icons/FileTextOutlined";
import LeftOutlined from "@ant-design/icons/LeftOutlined";
import RightOutlined from "@ant-design/icons/RightOutlined";
import Button from "antd/es/button";
import Card from "antd/es/card";
import Drawer from "antd/es/drawer";
import Space from "antd/es/space";
import Tooltip from "antd/es/tooltip";
import Typography from "antd/es/typography";
import { useState } from "react";

import type { FollowUpItem } from "../../services/formalization/follow-up-service";
import { ADMINISTRATION_DRAWER_CLOSE_PLACEMENT, ADMINISTRATION_DRAWER_PROPS } from "../administration/administration-theme";
import { FormalizationClientContent } from "./FormalizationClientDrawer";
import { OutlookCompose } from "./FormalizationContractSend";
import { FormalizationFiniquito } from "./FormalizationFiniquito";
import { FormalizationMarkAddendum } from "./FormalizationMarkAddendum";
import { FormalizationOrderAddendum } from "./FormalizationOrderAddendum";
import { OrderSectionFields } from "./FormalizationOrderDetails";
import { FormalizationPurchaseFunds } from "./FormalizationPurchaseFunds";
import { FormalizationRecordProgress } from "./FormalizationRecordProgress";
import { StageChip } from "./FormalizationStageChip";
import { FormalizationStageEditor } from "./FormalizationStageEditor";

/** Texto cuando el API no trae valor. Se muestra atenuado para no confundirlo con un dato guardado. */
const MISSING = "Sin dato";

function Value({ children }: { readonly children: string | null | undefined }) {
    return children?.trim() ? <>{children.trim()}</> : <Typography.Text type="secondary">{MISSING}</Typography.Text>;
}

function Section({ title, items }: { readonly title: string; readonly items: readonly { readonly key: string; readonly label: string; readonly value: React.ReactNode }[] }) {
    return (
        <Card size="small" title={title} className="formalization-compact-card formalization-compact-card--fields">
            <OrderSectionFields items={items} />
        </Card>
    );
}

function timeInStage(days: number | null): string | null {
    return days === null ? null : `${String(days)} ${days === 1 ? "día" : "días"} en la etapa`;
}

interface Props {
    readonly onNavigate?: ((path: string) => void) | undefined;
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
function OrderTitle({ item, markers }: { readonly item: FollowUpItem | null; readonly markers: React.ReactNode }) {
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
                <span className="user-detail-drawer__identity-meta formalization-order-meta">
                    <StageChip label={item.state.label} code={item.state.code} />
                    <span className="formalization-order-meta__sep" aria-hidden="true" />
                    {markers}
                </span>
            </div>
        </div>
    );
}

/** Arriba y abajo recorren la página, salvo si el foco está en un campo o un menú. Escribir no salta de fila. */
function walkWithArrows(event: React.KeyboardEvent, previous: () => void, next: () => void) {
    // Un evento lateral usa un portal: sus flechas no deben cambiar la orden detrás del formulario.
    if (!event.currentTarget.contains(event.target as Node)) return;
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
export function FormalizationOrderDrawer({ item, position, total, onClose, onSelectPrevious, onSelectNext, canUpdateStage = false, stagePermissions = [], onStageSaved, onRefreshOrder, onViewFull, onNavigate }: Props) {
    const [calendarRevision, setCalendarRevision] = useState(0);
    return (
        <Drawer
            {...ADMINISTRATION_DRAWER_PROPS}
            rootClassName="user-detail-drawer catalog-item-detail-drawer catalog-item-detail-drawer--projects formalization-order-drawer"
            closable={{ "aria-label": "Cerrar detalle de la orden", placement: ADMINISTRATION_DRAWER_CLOSE_PLACEMENT }}
            destroyOnHidden
            open={item !== null}
            title={
                <OrderTitle
                    item={item}
                    markers={
                        item && (
                            <>
                                <FormalizationOrderAddendum
                                    marker
                                    item={item}
                                    permissions={stagePermissions}
                                    refreshVersion={calendarRevision}
                                    onChanged={() => {
                                        setCalendarRevision((value) => value + 1);
                                        return onStageSaved?.();
                                    }}
                                />
                                <FormalizationPurchaseFunds
                                    marker
                                    key={`funds:${item.source}:${item.id}:${String(item.stateVersion)}:${String(item.purchaseFundsOrigin)}`}
                                    item={item}
                                    allowed={canUpdateStage}
                                    onSaved={() => onStageSaved?.()}
                                    onRefresh={() => {
                                        onClose();
                                        onRefreshOrder?.();
                                    }}
                                />
                            </>
                        )
                    }
                />
            }
            styles={{ ...ADMINISTRATION_DRAWER_PROPS.styles, wrapper: { ...ADMINISTRATION_DRAWER_PROPS.styles.wrapper, maxWidth: "100vw" }, body: { minHeight: 0, overflowY: "auto", overscrollBehavior: "contain" } }}
            footer={<OrderFooter position={position} total={total} onSelectPrevious={onSelectPrevious} onSelectNext={onSelectNext} />}
            onClose={onClose}
            onKeyDown={(event) => {
                walkWithArrows(event, onSelectPrevious, onSelectNext);
            }}
        >
            {item && (
                <div className="user-detail-drawer__sections">
                    <div className="formalization-drawer-actions">
                        <Button className="formalization-view-full" icon={<FileTextOutlined aria-hidden="true" />} onClick={onViewFull}>
                            Ver orden completa
                        </Button>
                        <FormalizationMarkAddendum
                            item={item}
                            permissions={stagePermissions}
                            onSaved={() => {
                                setCalendarRevision((value) => value + 1);
                                return onStageSaved?.();
                            }}
                        />
                    </div>
                    <FormalizationFiniquito item={item} allowed={canUpdateStage} />
                    <FormalizationRecordProgress item={item} compact />
                    <FormalizationStageEditor
                        key={`${item.source}:${item.id}:${String(item.stateVersion)}:${item.state.code}:${String(item.purchaseFundsOrigin)}`}
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
                    <div className="formalization-drawer-divider" role="separator" aria-label="Cliente y seguimiento">
                        <span>Cliente y seguimiento</span>
                    </div>
                    <FormalizationClientContent
                        key={`${item.source}:${item.id}`}
                        item={item}
                        contactOnly
                        effectivePermissions={stagePermissions}
                        onNavigate={onNavigate}
                        onCalendarClosed={() => {
                            setCalendarRevision((value) => value + 1);
                        }}
                    />
                    <Section
                        title="Seguimiento"
                        items={[
                            { key: "stage", label: "Etapa", value: <StageChip label={item.state.label} code={item.state.code} /> },
                            { key: "time", label: "Tiempo", value: <Value>{timeInStage(item.state.days)}</Value> },
                            { key: "responsible", label: "Responsable", value: <Value>{item.responsible?.name ?? "Sistema"}</Value> },
                            { key: "seller", label: "Vendedor", value: <Value>{item.seller?.name}</Value> },
                            { key: "next", label: "Siguiente paso", value: <Value>{item.nextStep}</Value> },
                        ]}
                    />
                </div>
            )}
        </Drawer>
    );
}
