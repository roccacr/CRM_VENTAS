import MailOutlined from "@ant-design/icons/MailOutlined";
import ReloadOutlined from "@ant-design/icons/ReloadOutlined";
import WhatsAppOutlined from "@ant-design/icons/WhatsAppOutlined";
import Button from "antd/es/button";

import type { IdentityProfile } from "../../services/auth/identity-contracts";
import { normalizeWhatsAppPhone } from "../../services/formalization/whatsapp-phone";
import type { LeadProfileResult } from "../../services/leads/lead-profile-service";
import { FormalizationScheduleEvent } from "../home/FormalizationScheduleEvent";
import { fieldValue, latestOrder } from "./lead-profile-model";

type Permissions = IdentityProfile["permissions"];
const WHATSAPP_PERMISSION = "formalizacion.orders.whatsapp";
const composeUrl = (email: string) => `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(email)}`;

/** La misma regla del panel de la orden: hace falta el allow exacto de `formalizacion.orders.whatsapp` y un deny lo quita. */
const canWhatsApp = (permissions: Permissions): boolean => permissions.some((entry) => entry.code === WHATSAPP_PERMISSION && entry.effect === "allow") && !permissions.some((entry) => entry.code === WHATSAPP_PERMISSION && entry.effect === "deny");

function WhatsAppAction({ data }: { readonly data: LeadProfileResult }) {
    const phone = normalizeWhatsAppPhone(fieldValue(data.sections, "phone"), fieldValue(data.sections, "countryCode"));
    return (
        <Button icon={<WhatsAppOutlined aria-hidden="true" />} {...(phone ? { href: `https://web.whatsapp.com/send?phone=${phone}` } : {})} target="_blank" rel="noopener noreferrer" disabled={!phone} title={phone ? undefined : "El cliente no tiene un teléfono válido para WhatsApp"}>
            Ir a WhatsApp
        </Button>
    );
}

/**
 * Acciones rápidas del perfil, las mismas que ofrecen los paneles de la orden y del cliente. Agendar usa la orden vinculada más reciente, porque el calendario
 * resuelve el lead a través de una orden. Sin una, el botón no se ofrece. El correo abre el borrador de Outlook y no envía desde el CRM.
 */
export function LeadProfileActions({ data, permissions, refreshing, onRefresh }: { readonly data: LeadProfileResult; readonly permissions: Permissions; readonly refreshing: boolean; readonly onRefresh: () => void }) {
    const email = fieldValue(data.sections, "email");
    const order = latestOrder(data.orders);
    return (
        <>
            {order && <FormalizationScheduleEvent key={`${order.source}:${order.id}`} item={{ source: order.source, id: order.id, number: order.number ?? order.id }} effectivePermissions={permissions} />}
            {canWhatsApp(permissions) && <WhatsAppAction data={data} />}
            {email && (
                <Button icon={<MailOutlined aria-hidden="true" />} href={composeUrl(email)} target="_blank" rel="noopener noreferrer">
                    Enviar correo
                </Button>
            )}
            <Button icon={<ReloadOutlined aria-hidden="true" />} loading={refreshing} onClick={onRefresh}>
                Actualizar
            </Button>
        </>
    );
}
