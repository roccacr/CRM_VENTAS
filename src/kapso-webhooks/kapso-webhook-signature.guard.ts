import { WebhookSignatureGuard } from "../common/webhooks/webhook-signature.guard";
import { KAPSO_PLATFORM_WEBHOOK_GUARD } from "./kapso-webhook.constants";

/**
 * Guard de firma HMAC Kapso Platform.
 * La politica vive en `WebhookSignatureGuard`; esto es solo config.
 *
 *   `@UseGuards(KapsoWebhookSignatureGuard)`
 */
export const KapsoWebhookSignatureGuard = WebhookSignatureGuard(KAPSO_PLATFORM_WEBHOOK_GUARD);
