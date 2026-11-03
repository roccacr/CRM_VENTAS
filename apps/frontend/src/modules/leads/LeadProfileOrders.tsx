import ArrowRightOutlined from "@ant-design/icons/ArrowRightOutlined";
import ShoppingOutlined from "@ant-design/icons/ShoppingOutlined";
import Button from "antd/es/button";
import Tag from "antd/es/tag";
import { useState } from "react";

import type { LeadProfileOrder, LeadProfileResult } from "../../services/leads/lead-profile-service";
import { formatAmount, formatStamp, type OrderFilter, orderHref, orderStatus, ORIGIN_LABEL, profileOrders } from "./lead-profile-model";
import { ProfileCard } from "./LeadProfileFields";

type Orders = LeadProfileResult["orders"];
interface Props {
    readonly orders: Orders;
    readonly page: number;
    readonly refreshing: boolean;
    readonly onPage: (page: number) => void;
}
const FILTERS: readonly { readonly id: OrderFilter; readonly label: string }[] = [
    { id: "all", label: "Todas" },
    { id: "native", label: "Nativas" },
    { id: "legacy", label: "Anteriores" },
];

function OrderRow({ order, withCurrency }: { readonly order: LeadProfileOrder; readonly withCurrency: boolean }) {
    const status = orderStatus(order.status);
    return (
        <tr>
            <th scope="row">{order.number ?? order.id}</th>
            <td>
                <Tag>{ORIGIN_LABEL[order.source]}</Tag>
            </td>
            <td>{order.date ? formatStamp(order.date) : "—"}</td>
            <td>{status ? <span className="profile-chip">{status}</span> : "—"}</td>
            {withCurrency && <td>{order.currency ?? "—"}</td>}
            <td className="profile-table__number">{formatAmount(order.amount)}</td>
            <td className="profile-table__action">
                <a className="profile-link" href={orderHref(order)} aria-label={`Ver orden ${order.number ?? order.id}`}>
                    Ver orden <ArrowRightOutlined aria-hidden="true" />
                </a>
            </td>
        </tr>
    );
}
function OrdersTable({ rows }: { readonly rows: readonly LeadProfileOrder[] }) {
    // A column nobody fills is noise: currency appears only when at least one order reports it.
    const withCurrency = rows.some((order) => order.currency);
    return (
        <div className="profile-table-wrap">
            <table className="profile-table">
                <thead>
                    <tr>
                        <th scope="col">Orden</th>
                        <th scope="col">Origen</th>
                        <th scope="col">Fecha</th>
                        <th scope="col">Estado</th>
                        {withCurrency && <th scope="col">Moneda</th>}
                        <th scope="col" className="profile-table__number">
                            Monto
                        </th>
                        <th scope="col">
                            <span className="profile-sr">Acciones</span>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((order) => (
                        <OrderRow key={`${order.source}:${order.id}`} order={order} withCurrency={withCurrency} />
                    ))}
                </tbody>
            </table>
        </div>
    );
}
function OrderFilters({ orders, filter, onChange }: { readonly orders: Orders; readonly filter: OrderFilter; readonly onChange: (filter: OrderFilter) => void }) {
    return (
        <div className="profile-toolbar">
            <div className="profile-filter" role="group" aria-label="Origen de las órdenes">
                {FILTERS.map((option) => (
                    <button
                        key={option.id}
                        type="button"
                        aria-pressed={option.id === filter}
                        onClick={() => {
                            onChange(option.id);
                        }}
                    >
                        {option.label}
                        <em>{profileOrders(orders, option.id).length}</em>
                    </button>
                ))}
            </div>
        </div>
    );
}

/** Sales orders linked to the client, one table for both sources; each row opens the order in the orders view. The pager only appears when there is another page. */
export function LeadProfileOrders({ orders, page, refreshing, onPage }: Props) {
    const [filter, setFilter] = useState<OrderFilter>("all");
    const rows = profileOrders(orders, filter);
    const hasMore = orders.native.hasMore || orders.legacy.hasMore;
    return (
        <ProfileCard title="Órdenes de venta" className="profile-card--orders">
            <OrderFilters orders={orders} filter={filter} onChange={setFilter} />
            <div className="profile-section-body" aria-busy={refreshing} data-loading={refreshing}>
                {rows.length === 0 ? (
                    <div className="profile-empty">
                        <ShoppingOutlined aria-hidden="true" />
                        <p>Sin órdenes en esta página.</p>
                    </div>
                ) : (
                    <OrdersTable rows={rows} />
                )}
            </div>
            {(page > 1 || hasMore) && (
                <footer className="profile-pager">
                    <Button
                        disabled={page === 1 || refreshing}
                        onClick={() => {
                            onPage(page - 1);
                        }}
                    >
                        Órdenes anteriores
                    </Button>
                    <span>Página {page}</span>
                    <Button
                        disabled={!hasMore || refreshing}
                        onClick={() => {
                            onPage(page + 1);
                        }}
                    >
                        Más órdenes
                    </Button>
                </footer>
            )}
        </ProfileCard>
    );
}
