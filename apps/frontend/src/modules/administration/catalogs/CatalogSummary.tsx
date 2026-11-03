import "./CatalogSummary.css";
import "./EnterpriseSurface.css";

import AppstoreOutlined from "@ant-design/icons/AppstoreOutlined";
import BankOutlined from "@ant-design/icons/BankOutlined";
import CheckCircleOutlined from "@ant-design/icons/CheckCircleOutlined";
import ClockCircleOutlined from "@ant-design/icons/ClockCircleOutlined";
import DatabaseOutlined from "@ant-design/icons/DatabaseOutlined";
import FileSearchOutlined from "@ant-design/icons/FileSearchOutlined";
import FileTextOutlined from "@ant-design/icons/FileTextOutlined";
import LinkOutlined from "@ant-design/icons/LinkOutlined";
import LockOutlined from "@ant-design/icons/LockOutlined";
import SendOutlined from "@ant-design/icons/SendOutlined";
import StopOutlined from "@ant-design/icons/StopOutlined";
import SwapOutlined from "@ant-design/icons/SwapOutlined";
import TeamOutlined from "@ant-design/icons/TeamOutlined";
import type { ReactNode } from "react";

import { FormHelp } from "../../../components/forms/FormHelp";
import type { CatalogBannerData, CatalogBannerIcon } from "./catalog-summary";

const ICONS: Readonly<Record<CatalogBannerIcon, ReactNode>> = {
    total: <DatabaseOutlined />,
    active: <CheckCircleOutlined />,
    inactive: <StopOutlined />,
    linked: <LinkOutlined />,
    projects: <AppstoreOutlined />,
    loaded: <FileSearchOutlined />,
    selected: <SwapOutlined />,
    people: <TeamOutlined />,
    pending: <ClockCircleOutlined />,
    blocked: <LockOutlined />,
    contract: <FileTextOutlined />,
    send: <SendOutlined />,
    bank: <BankOutlined />,
};

/** Same card anatomy as the Home pages. A card only reports a figure: filtering is done with the list's own filters. */
function CatalogBanner({ title, value, caption, icon, tone, metrics, helpText }: Omit<CatalogBannerData, "id">) {
    return (
        <article className={`catalog-banner catalog-banner--${tone}`}>
            <span className="catalog-banner__icon" aria-hidden="true">
                {ICONS[icon]}
            </span>
            <div className="catalog-banner__content">
                {helpText ? (
                    <div className="catalog-banner__heading">
                        <h2 className="catalog-banner__title">{title}</h2>
                        <FormHelp label={`Condiciones de ${title}`} text={helpText} />
                    </div>
                ) : (
                    <h2 className="catalog-banner__title">{title}</h2>
                )}
                {metrics ? (
                    <div className="catalog-banner__metrics">
                        {metrics.map((metric) => (
                            <div key={metric.label}>
                                <strong aria-label={`${metric.label}: ${metric.value}`}>{metric.value}</strong>
                                <span className="catalog-banner__caption">{metric.label}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <>
                        <strong aria-label={`${title}: ${value}`}>{value}</strong>
                        <span className="catalog-banner__caption">{caption}</span>
                    </>
                )}
            </div>
            <span className="catalog-banner__pattern" aria-hidden="true">
                {Array.from({ length: 6 }, (_, index) => (
                    <i key={index} style={{ width: 64 - index * 8, height: 64 - index * 8 }} />
                ))}
            </span>
        </article>
    );
}

/** Summary row shared by every catalog view, whichever area opens it. */
export function CatalogBanners({ cards, label }: { readonly cards: readonly CatalogBannerData[]; readonly label: string }) {
    return (
        <section className="catalog-banners" aria-label={label}>
            {cards.map(({ id, ...card }) => (
                <CatalogBanner key={id} {...card} />
            ))}
        </section>
    );
}
