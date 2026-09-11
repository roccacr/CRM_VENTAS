import { KapsoWebhookSignatureService } from "../../src/kapso-webhooks/kapso-webhook-signature.service";
import { verifyHmacSha256Signature } from "../../src/common/crypto/hmac-sha256-signature";
import { signHmacSha256Hex } from "../common/crypto/hmac-sign";

/**
 * Thin wrapper: solo comprueba que delega a la primitiva common.
 * Casos de HMAC completos viven en common/crypto/hmac-sha256-signature.spec.ts.
 */
describe("KapsoWebhookSignatureService", () => {
    it("delegates verify to verifyHmacSha256Signature", () => {
        const service = new KapsoWebhookSignatureService();
        const secret = "test-secret";
        const rawBody = '{"ok":true}';
        const signature = signHmacSha256Hex(rawBody, secret);

        expect(service.verify(rawBody, signature, secret)).toBe(verifyHmacSha256Signature(rawBody, signature, secret));
    });

    it("propagates false when the signature does not match", () => {
        const service = new KapsoWebhookSignatureService();

        expect(service.verify('{"ok":true}', "bad-signature", "test-secret")).toBe(false);
        expect(service.verify('{"ok":true}', "bad-signature", "test-secret")).toBe(verifyHmacSha256Signature('{"ok":true}', "bad-signature", "test-secret"));
    });
});
