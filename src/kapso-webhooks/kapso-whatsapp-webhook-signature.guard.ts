import { WebhookSignatureGuard } from "../common/webhooks/webhook-signature.guard";
import { KAPSO_WHATSAPP_WEBHOOK_GUARD } from "./kapso-webhook.constants";

/**
 * Firma HMAC para webhooks WhatsApp por numero.
 * Sin `KAPSO_WHATSAPP_WEBHOOK_SECRET` el guard falla cerrado (503).
 */
export const KapsoWhatsappWebhookSignatureGuard = WebhookSignatureGuard(KAPSO_WHATSAPP_WEBHOOK_GUARD);
