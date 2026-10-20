import "./FormalizationHomePage.css";

import ArrowLeftOutlined from "@ant-design/icons/ArrowLeftOutlined";
import BankOutlined from "@ant-design/icons/BankOutlined";
import CheckCircleOutlined from "@ant-design/icons/CheckCircleOutlined";
import FileDoneOutlined from "@ant-design/icons/FileDoneOutlined";
import FileTextOutlined from "@ant-design/icons/FileTextOutlined";
import SafetyCertificateOutlined from "@ant-design/icons/SafetyCertificateOutlined";
import SwapOutlined from "@ant-design/icons/SwapOutlined";
import WalletOutlined from "@ant-design/icons/WalletOutlined";
import Button from "antd/es/button";
import ConfigProvider from "antd/es/config-provider";
import esES from "antd/es/locale/es_ES";
import { useState } from "react";

import type { IdentityUser } from "../../services/auth/identity-contracts";
import { PROJECTS_THEME } from "../administration/catalogs/projects-theme";
import { type FormalizationExample, formatOrderTotal, matchesPreviewFilter, PREVIEW_FILTER_TITLES, type PreviewQueue } from "./formalization-preview.model";
import { useFormalizationPreview } from "./formalization-preview-session";
import { FormalizationFollowUpPreview } from "./FormalizationFollowUpPreview";
import { FormalizationHomeInsights } from "./FormalizationHomeInsights";
import { FormalizationOrderPreview } from "./FormalizationOrderPreview";
import { FormalizationPreviewBoundary } from "./FormalizationPreviewSession";
import { FormalizationTimingPreview } from "./FormalizationTimingPreview";
import type { EffectiveNavigationPermission } from "./GlobalHomeShell";

interface FormalizationHomeProps {
    readonly currentUser?: Pick<IdentityUser, "displayName" | "email">;
    readonly effectivePermissions?: readonly EffectiveNavigationPermission[];
    readonly initialView?: "home" | "orders";
    readonly onNavigate?: ((path: string) => void) | undefined;
}

const greetingFor = (user: FormalizationHomeProps["currentUser"]) => {
    const name = user?.displayName.trim() || user?.email.trim() || "";
    return name ? `Hola, ${name}` : "Hola";
};

/** Misma esquina, mismo recorte, en la aprobación y en las seis etapas. */
function BannerCorner() {
    return (
        <span className="formalization-banner__pattern" aria-hidden="true">
            {Array.from({ length: 6 }, (_, index) => (
                <i key={index} />
            ))}
        </span>
    );
}

/** Deny wins; revocation also removes an already opened approval queue. */
function resolveApprovalVisibility(permissions: readonly EffectiveNavigationPermission[] | undefined, selectedQueue: PreviewQueue | null) {
    const entries = (permissions ?? []).filter((permission) => permission.code === "formalizacion.home.approvals.read");
    const canView = entries.some((permission) => permission.effect === "allow") && !entries.some((permission) => permission.effect === "deny");
    return { canView, queue: selectedQueue?.filter === "approvals" && !canView ? null : selectedQueue };
}

function ApprovalStrip({ count, onOpen }: { readonly count: number; readonly onOpen: () => void }) {
    return (
        <button type="button" className="formalization-banner formalization-banner--pending formalization-approval-strip" aria-label="Ver pendientes de aprobación de Formalización" onClick={onOpen}>
            <span className="formalization-banner__icon" aria-hidden="true">
                <SafetyCertificateOutlined />
            </span>
            <span className="formalization-banner__content">
                <span className="formalization-approval-strip__title">Pendientes de aprobación</span>
                <span className="formalization-banner__metrics">
                    <span className="formalization-banner__metric">
                        <span className="formalization-banner__value" aria-label={`Órdenes pendientes de aprobación: ${String(count)}`}>
                            {count}
                        </span>
                        <span className="formalization-banner__caption">Por revisar</span>
                    </span>
                </span>
            </span>
            <BannerCorner />
        </button>
    );
}

const banners = [
    {
        code: "contracts",
        label: "Contratos pendientes",
        icon: <FileTextOutlined />,
        tone: "pending",
        parts: [
            { label: "Por enviar", value: 1, filter: "send" },
            { label: "Pendientes de firma", value: 1, filter: "signature" },
        ],
    },
    { code: "bank", label: "Gestión bancaria", icon: <BankOutlined />, tone: "neutral", parts: [{ label: "Sin iniciar / En proceso", value: 1, filter: "bank" }] },
    { code: "balance", label: "Pendientes de saldo", icon: <WalletOutlined />, tone: "neutral", parts: [{ label: "Consulta financiera", value: 1, filter: "balance" }] },
    { code: "transfer", label: "Traspasos pendientes", icon: <SwapOutlined />, tone: "pending", parts: [{ label: "Por gestionar", value: 1, filter: "transfer" }] },
    { code: "signed", label: "Traspaso firmado", icon: <FileDoneOutlined />, tone: "success", parts: [{ label: "Firma registrada · Llaves pendientes", value: 3, filter: "signed" }] },
    { code: "closed", label: "Formalizaciones cerradas este año", icon: <CheckCircleOutlined />, tone: "success", parts: [{ label: "Proceso finalizado", value: 0, filter: "closed" }] },
] as const;

const getQueueTitle = (queue: PreviewQueue) => `${PREVIEW_FILTER_TITLES[queue.filter]}${queue.project ? ` · ${queue.project}` : ""}`;
const countQueue = (queue: PreviewQueue, orders: readonly FormalizationExample[]) => orders.filter((item) => matchesPreviewFilter(item, queue.filter) && (!queue.project || item.project === queue.project)).length;

/** Encabezado de la lista filtrada con la anatomía de Proyectos: ruta, título, total y acciones. */
function QueueHeader({ queue, onHome, onAll }: { readonly queue: PreviewQueue; readonly onHome: () => void; readonly onAll: () => void }) {
    const { orders } = useFormalizationPreview();
    const showAll = queue.filter !== "all" || queue.project !== undefined;
    return (
        <>
            <Button className="formalization-back" type="text" aria-label="Volver a Inicio" icon={<ArrowLeftOutlined />} onClick={onHome}>
                Volver a Inicio
            </Button>
            <header className="global-home-page-header formalization-page-header">
                <div>
                    <nav className="formalization-breadcrumb" aria-label="Ruta">
                        <span>Formalización</span>
                        <span aria-hidden="true">/</span>
                        <span>Órdenes de venta</span>
                    </nav>
                    <div className="formalization-title-row">
                        <h1
                            tabIndex={-1}
                            ref={(node) => {
                                node?.focus();
                            }}
                        >
                            {getQueueTitle(queue)}
                        </h1>
                        <span className="formalization-total">{formatOrderTotal(countQueue(queue, orders))}</span>
                    </div>
                </div>
                {showAll && (
                    <div className="global-home-page-header__actions">
                        <Button className="formalization-command" onClick={onAll}>
                            Todas las órdenes
                        </Button>
                    </div>
                )}
            </header>
        </>
    );
}

/** Propuesta visual del Inicio: no consulta datos ni habilita acciones operativas. */
function FormalizationHomeContent({ currentUser, effectivePermissions, initialView = "home", onNavigate }: FormalizationHomeProps) {
    const { orders } = useFormalizationPreview();
    const [selectedQueue, setQueue] = useState<PreviewQueue | null>(() => (initialView === "orders" ? { filter: "all" } : null));
    const { canView: canViewApprovals, queue } = resolveApprovalVisibility(effectivePermissions, selectedQueue);
    const [selected, setSelected] = useState<FormalizationExample | null>(null);
    return (
        <ConfigProvider locale={esES} theme={PROJECTS_THEME}>
            <div className="global-home-dashboard formalization-home">
                {selected && (
                    <FormalizationOrderPreview
                        order={selected}
                        onNavigate={onNavigate}
                        onBack={() => {
                            setSelected(null);
                        }}
                    />
                )}
                <div hidden={selected !== null || queue !== null}>
                    <section className="global-home-page-header formalization-home__header" aria-labelledby="formalization-home-title">
                        <div>
                            <h1 id="formalization-home-title">Formalización</h1>
                        </div>
                        <div className="formalization-home__intro" data-has-approvals={canViewApprovals}>
                            {canViewApprovals && (
                                <ApprovalStrip
                                    count={countQueue({ filter: "approvals" }, orders)}
                                    onOpen={() => {
                                        setQueue({ filter: "approvals" });
                                    }}
                                />
                            )}
                            <section className="formalization-welcome" aria-label="Bienvenida a Formalización">
                                <div className="formalization-welcome__copy">
                                    <p className="formalization-welcome__title">{greetingFor(currentUser)}</p>
                                    <p className="formalization-welcome__text">Gestión contractual</p>
                                    <Button
                                        className="formalization-command"
                                        onClick={() => {
                                            setQueue({ filter: "all" });
                                        }}
                                    >
                                        Ver todas las órdenes
                                    </Button>
                                </div>
                                <img className="formalization-welcome__art" src={`${import.meta.env.BASE_URL}illustrations/rocca-formalization-generated.png`} alt="" width={1754} height={897} decoding="async" />
                            </section>
                        </div>
                    </section>
                    <section className="formalization-home__banners" aria-label="Resumen de formalización">
                        {banners.map((banner) => (
                            <article key={banner.code} className={`formalization-banner formalization-banner--${banner.tone}`} aria-labelledby={`formalization-${banner.code}`}>
                                <span className="formalization-banner__icon" aria-hidden="true">
                                    {banner.icon}
                                </span>
                                <div className="formalization-banner__content">
                                    <h2 id={`formalization-${banner.code}`}>{banner.label}</h2>
                                    <div className="formalization-banner__metrics">
                                        {banner.parts.map((part) => (
                                            <button
                                                key={part.label}
                                                type="button"
                                                className="formalization-banner__metric formalization-banner__metric-button"
                                                aria-label={`Abrir ${part.label}`}
                                                onClick={() => {
                                                    setQueue({ filter: part.filter });
                                                }}
                                            >
                                                <span className="formalization-banner__value" aria-label={`Valor: ${part.label}, ${String(countQueue({ filter: part.filter }, orders))}`}>
                                                    {countQueue({ filter: part.filter }, orders)}
                                                </span>
                                                <span className="formalization-banner__caption">{part.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <BannerCorner />
                            </article>
                        ))}
                    </section>
                    <div className="formalization-workspace">
                        <FormalizationFollowUpPreview tableOnly={false} scope={{ filter: "all" }} onOpenOrder={setSelected} />
                        <FormalizationHomeInsights onOpenOrder={setSelected} onOpenQueue={setQueue} />
                        <FormalizationTimingPreview onOpenOrder={setSelected} />
                    </div>
                </div>
                <div className="formalization-workspace" hidden={selected !== null || queue === null}>
                    {queue && (
                        <>
                            <QueueHeader
                                queue={queue}
                                onHome={() => {
                                    if (initialView === "orders" && onNavigate) {
                                        onNavigate("/home/formalization");
                                        return;
                                    }
                                    setQueue(null);
                                }}
                                onAll={() => {
                                    setQueue({ filter: "all" });
                                }}
                            />
                            <FormalizationFollowUpPreview key={`${queue.filter}-${queue.project ?? "all"}`} tableOnly scope={queue} onOpenOrder={setSelected} />
                        </>
                    )}
                </div>
            </div>
        </ConfigProvider>
    );
}

/** Inicio y bandejas comparten la misma simulación durante el recorrido del módulo. */
export function FormalizationHomePage(props: FormalizationHomeProps) {
    return (
        <FormalizationPreviewBoundary>
            <FormalizationHomeContent {...props} />
        </FormalizationPreviewBoundary>
    );
}
