import "./FormalizationContractSend.css";

import MailOutlined from "@ant-design/icons/MailOutlined";
import Button from "antd/es/button";
import Card from "antd/es/card";
import Typography from "antd/es/typography";

import type { FollowUpItem } from "../../services/formalization/follow-up-service";
import { OrderSectionFields } from "./FormalizationOrderDetails";

/** Abre un borrador dirigido al cliente; no envia correos ni registra una transicion. */
export function OutlookCompose({ item }: { readonly item: FollowUpItem }) {
    if (item.state.code !== "contract_pending_send") return null;
    return (
        <Card size="small" title="Envío del contrato" className="formalization-contract-send">
            {item.clientEmail ? (
                <div className="formalization-contract-send__content">
                    <OrderSectionFields items={[{ key: "email", label: "Correo del cliente", value: item.clientEmail }]} />
                    <Button icon={<MailOutlined aria-hidden="true" />} href={`https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(item.clientEmail)}`} target="_blank" rel="noopener noreferrer">
                        Abrir Outlook
                    </Button>
                </div>
            ) : (
                <Typography.Text type="secondary">Correo del cliente no disponible</Typography.Text>
            )}
        </Card>
    );
}
