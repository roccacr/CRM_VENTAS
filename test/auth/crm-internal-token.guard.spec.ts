import { ExecutionContext, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";

import { CrmInternalTokenGuard } from "../../src/auth/crm-internal-token.guard";
import { createConfigServiceMock, createHttpExecutionContext, instantiateMixinGuard } from "../common/auth/mocks";

/**
 * Spec del guard CRM = solo config sobre InternalTokenGuard.
 * La política (503/401/timing-safe) se audita en common; acá validamos el wiring CRM.
 */
describe("CrmInternalTokenGuard", () => {
    const createGuard = (token: string | undefined): { canActivate: (context: ExecutionContext) => boolean } => instantiateMixinGuard(CrmInternalTokenGuard, createConfigServiceMock(token));

    it("allows requests with a valid Bearer token", () => {
        const guard = createGuard("crm-token");

        expect(guard.canActivate(createHttpExecutionContext({ headers: { authorization: "Bearer crm-token" } }))).toBe(true);
    });

    it("allows requests with a valid x-crm-api-token header", () => {
        const guard = createGuard("crm-token");

        expect(guard.canActivate(createHttpExecutionContext({ headers: { "x-crm-api-token": "crm-token" } }))).toBe(true);
    });

    it("rejects requests without token", () => {
        const guard = createGuard("crm-token");

        expect(() => guard.canActivate(createHttpExecutionContext({ headers: {} }))).toThrow(UnauthorizedException);
    });

    it("rejects requests with an invalid token", () => {
        const guard = createGuard("crm-token");

        expect(() => guard.canActivate(createHttpExecutionContext({ headers: { authorization: "Bearer wrong" } }))).toThrow(UnauthorizedException);
    });

    it("fails closed when CRM_API_INTERNAL_TOKEN is not configured", () => {
        const guard = createGuard(undefined);

        expect(() => guard.canActivate(createHttpExecutionContext({ headers: { authorization: "Bearer crm-token" } }))).toThrow(ServiceUnavailableException);
    });

    it("fails closed when CRM_API_INTERNAL_TOKEN is an empty string", () => {
        const guard = createGuard("");

        expect(() => guard.canActivate(createHttpExecutionContext({ headers: { authorization: "Bearer crm-token" } }))).toThrow(ServiceUnavailableException);
    });
});
