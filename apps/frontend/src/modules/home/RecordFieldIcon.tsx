import AimOutlined from "@ant-design/icons/AimOutlined";
import ApartmentOutlined from "@ant-design/icons/ApartmentOutlined";
import BankOutlined from "@ant-design/icons/BankOutlined";
import BulbOutlined from "@ant-design/icons/BulbOutlined";
import CalendarOutlined from "@ant-design/icons/CalendarOutlined";
import CloseCircleOutlined from "@ant-design/icons/CloseCircleOutlined";
import CommentOutlined from "@ant-design/icons/CommentOutlined";
import CreditCardOutlined from "@ant-design/icons/CreditCardOutlined";
import DashboardOutlined from "@ant-design/icons/DashboardOutlined";
import DollarOutlined from "@ant-design/icons/DollarOutlined";
import EnvironmentOutlined from "@ant-design/icons/EnvironmentOutlined";
import FileDoneOutlined from "@ant-design/icons/FileDoneOutlined";
import FileTextOutlined from "@ant-design/icons/FileTextOutlined";
import HomeOutlined from "@ant-design/icons/HomeOutlined";
import IdcardOutlined from "@ant-design/icons/IdcardOutlined";
import ImportOutlined from "@ant-design/icons/ImportOutlined";
import KeyOutlined from "@ant-design/icons/KeyOutlined";
import NotificationOutlined from "@ant-design/icons/NotificationOutlined";
import NumberOutlined from "@ant-design/icons/NumberOutlined";
import OrderedListOutlined from "@ant-design/icons/OrderedListOutlined";
import PercentageOutlined from "@ant-design/icons/PercentageOutlined";
import ProfileOutlined from "@ant-design/icons/ProfileOutlined";
import SafetyCertificateOutlined from "@ant-design/icons/SafetyCertificateOutlined";
import SwapOutlined from "@ant-design/icons/SwapOutlined";
import TagOutlined from "@ant-design/icons/TagOutlined";
import TagsOutlined from "@ant-design/icons/TagsOutlined";
import TeamOutlined from "@ant-design/icons/TeamOutlined";
import UserOutlined from "@ant-design/icons/UserOutlined";
import WalletOutlined from "@ant-design/icons/WalletOutlined";
import type { ReactNode } from "react";

/** First match wins, so the specific labels come before the general ones. */
const RULES: readonly (readonly [RegExp, ReactNode])[] = [
    [/^N\.º de pedido|^Número de transacción/, <NumberOutlined />],
    [/^Cantidad de tractos/, <OrderedListOutlined />],
    [/%/, <PercentageOutlined />],
    [/^Cliente$/, <UserOutlined />],
    [/^Representante/, <IdcardOutlined />],
    [/^Socio/, <TeamOutlined />],
    [/^Firma de contrato/, <FileDoneOutlined />],
    [/^Vigencia de garantía/, <SafetyCertificateOutlined />],
    [/^Fecha|^Entrega estimada|^Fechas/, <CalendarOutlined />],
    [/^Tipo de cambio/, <SwapOutlined />],
    [/^Moneda/, <DollarOutlined />],
    [/^Estado de cuenta/, <ProfileOutlined />],
    [/^Subsidiaria/, <BankOutlined />],
    [/^Departamento/, <ApartmentOutlined />],
    [/^Clase/, <TagOutlined />],
    [/^Ubicación/, <EnvironmentOutlined />],
    [/^Traspaso/, <KeyOutlined />],
    [/medidor de agua/, <DashboardOutlined />],
    [/^Motivo de cancelación/, <CloseCircleOutlined />],
    [/^Avisos/, <NotificationOutlined />],
    [/^Nota|^Comentario|^Observaciones|^Descripción|notes$/, <CommentOutlined />],
    [/^Unidad expediente/, <HomeOutlined />],
    [/^Oportunidad/, <AimOutlined />],
    [/^Creado desde/, <ImportOutlined />],
    [/^Campaña/, <NotificationOutlined />],
    [/^Motivo de compra/, <BulbOutlined />],
    [/^Método de pago|^Medio de pago/, <CreditCardOutlined />],
    [/^Fondos de compra/, <WalletOutlined />],
    [/^Precio/, <TagsOutlined />],
    [/^Monto|^Prima|^Hito|^Cargos|^Cashback|^Diferencia/, <DollarOutlined />],
];

/** One small icon in front of each field name. Decorative: the name stays the accessible text. */
export function RecordFieldIcon({ label }: { readonly label: string }) {
    const icon = RULES.find(([pattern]) => pattern.test(label))?.[1] ?? <FileTextOutlined />;
    return (
        <span className="record-field__icon" aria-hidden="true">
            {icon}
        </span>
    );
}
