import { Controller, Get, HttpCode, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags, ApiUnauthorizedResponse } from "@nestjs/swagger";

import { CrmInternalTokenGuard } from "../auth/crm-internal-token.guard";
import { KapsoWhatsappNumberDto, KapsoWhatsappNumbersService, KapsoWhatsappNumberSyncDto, KapsoWhatsappNumberStatusDto } from "./kapso-whatsapp-numbers.service";
import { toDataEnvelope } from "./to-data-envelope";

/**
 * API interna CRM: `/api/v1/kapso/whatsapp-numbers`.
 * Todas las rutas exigen CrmInternalTokenGuard (Bearer o x-crm-api-token).
 */
@ApiTags("Kapso WhatsApp numbers")
@ApiBearerAuth()
@UseGuards(CrmInternalTokenGuard)
@Controller("kapso/whatsapp-numbers")
export class KapsoWhatsappNumbersController {
    constructor(private readonly service: KapsoWhatsappNumbersService) {}

    @Get()
    @ApiOperation({ summary: "List Kapso WhatsApp number integrations for CRM." })
    @ApiOkResponse({ description: "Integrations listed." })
    @ApiUnauthorizedResponse({ description: "Invalid CRM internal token." })
    async findAll(): Promise<{ data: KapsoWhatsappNumberDto[] }> {
        return toDataEnvelope(await this.service.findAll());
    }

    @Post("sync")
    @HttpCode(200)
    @ApiOperation({ summary: "Synchronize Kapso WhatsApp number details into CRM DB." })
    @ApiOkResponse({ description: "Kapso phone numbers synchronized." })
    @ApiUnauthorizedResponse({ description: "Invalid CRM internal token." })
    sync(): Promise<KapsoWhatsappNumberSyncDto> {
        return this.service.syncFromKapso();
    }

    @Post(":id/sync")
    @HttpCode(200)
    @ApiOperation({ summary: "Synchronize one Kapso WhatsApp number integration by local id." })
    @ApiParam({ name: "id" })
    @ApiOkResponse({ description: "Kapso phone number synchronized." })
    @ApiUnauthorizedResponse({ description: "Invalid CRM internal token." })
    syncOne(@Param("id") id: string): Promise<KapsoWhatsappNumberSyncDto> {
        return this.service.syncOneFromKapso(id);
    }

    @Patch(":id/activate")
    @ApiOperation({ summary: "Activate one Kapso WhatsApp number integration." })
    @ApiParam({ name: "id" })
    @ApiOkResponse({ description: "Integration activated." })
    @ApiUnauthorizedResponse({ description: "Invalid CRM internal token." })
    activate(@Param("id") id: string): Promise<KapsoWhatsappNumberStatusDto> {
        return this.service.activate(id);
    }

    @Patch(":id/deactivate")
    @ApiOperation({ summary: "Deactivate one Kapso WhatsApp number integration." })
    @ApiParam({ name: "id" })
    @ApiOkResponse({ description: "Integration deactivated." })
    @ApiUnauthorizedResponse({ description: "Invalid CRM internal token." })
    deactivate(@Param("id") id: string): Promise<KapsoWhatsappNumberStatusDto> {
        return this.service.deactivate(id);
    }
}
