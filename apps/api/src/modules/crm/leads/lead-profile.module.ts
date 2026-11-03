import { Module } from "@nestjs/common";

import { IdentityModule } from "../identity/identity.module.js";
import { LeadProfileController } from "./lead-profile.controller.js";
import { LeadProfileRepository } from "./lead-profile.repository.js";
import { LeadProfileService } from "./lead-profile.service.js";

/** Registra únicamente el slice de lectura del perfil completo. */
@Module({ imports: [IdentityModule], controllers: [LeadProfileController], providers: [LeadProfileRepository, LeadProfileService] })
export class LeadProfileModule {}
