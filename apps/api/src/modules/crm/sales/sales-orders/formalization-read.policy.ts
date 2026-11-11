import { ForbiddenException, NotFoundException } from "@nestjs/common";

import { canReadFormalizationOrder } from "../../../../common/security/route-permission.js";
import type { IdentityAuthorizationProfile } from "../../identity/identity.types.js";
import type { TimingOrder } from "./order-timing.contract.js";
/** El acceso al detalle no depende de un banner ni de la clasificación de etapa. */
export function assertFormalizationOrderReadable(profile: IdentityAuthorizationProfile, order: TimingOrder, includeInactive = false): void {
    if (!canReadFormalizationOrder(profile)) throw new ForbiddenException("No tiene permiso para consultar esta orden.");
    if (order.deleted || (!includeInactive && !order.active)) throw new NotFoundException("Orden disponible no encontrada.");
}
