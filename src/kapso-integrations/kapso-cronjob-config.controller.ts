import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiConflictResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags, ApiUnauthorizedResponse } from "@nestjs/swagger";

import { CrmInternalTokenGuard } from "../auth/crm-internal-token.guard";
import { KapsoCronjobConfigBodyDto, KapsoCronjobProjectConfigBodyDto } from "./kapso-cronjob-config.dto";
import { KapsoCronjobConfigDto, KapsoCronjobConfigService, KapsoCronjobProjectConfigDto } from "./kapso-cronjob-config.service";
import { toDataEnvelope } from "./to-data-envelope";

/**
 * Endpoints internos para activar/inactivar cronjobs y configurar sus proyectos ejecutables.
 * El cronjob general no expone DELETE operativo; se pausa con PATCH isActive=false.
 */
@ApiTags("Kapso cronjob configs")
@ApiBearerAuth()
@UseGuards(CrmInternalTokenGuard)
@Controller("kapso")
export class KapsoCronjobConfigController {
    constructor(private readonly service: KapsoCronjobConfigService) {}

    @Get("cronjob-configs")
    @ApiOperation({ summary: "List general Kapso cronjob configs with project scopes." })
    @ApiOkResponse({ description: "Kapso cronjob configs listed." })
    @ApiUnauthorizedResponse({ description: "Invalid CRM internal token." })
    listConfigs(): Promise<{ data: KapsoCronjobConfigDto[] }> {
        return this.service.listConfigs().then(toDataEnvelope);
    }

    @Post("cronjob-configs")
    @ApiOperation({ summary: "Create one general Kapso cronjob config." })
    @ApiBody({
        schema: {
            properties: {
                config: { example: {}, type: "object" },
                cronjobId: { example: "kapso-sync-chats-rdg", type: "string" },
                isActive: { example: true, type: "boolean" },
            },
            required: ["cronjobId", "isActive"],
            type: "object",
        },
    })
    @ApiCreatedResponse({ description: "Kapso cronjob config created." })
    @ApiConflictResponse({ description: "Cronjob id already exists." })
    @ApiUnauthorizedResponse({ description: "Invalid CRM internal token." })
    createConfig(@Body() body: KapsoCronjobConfigBodyDto): Promise<KapsoCronjobConfigDto> {
        return this.service.createConfig(body);
    }

    @Patch("cronjob-configs/:id")
    @ApiOperation({ summary: "Update one general Kapso cronjob config." })
    @ApiParam({ name: "id" })
    @ApiOkResponse({ description: "Kapso cronjob config updated." })
    @ApiConflictResponse({ description: "Cronjob id already exists." })
    @ApiNotFoundResponse({ description: "Cronjob config not found." })
    @ApiUnauthorizedResponse({ description: "Invalid CRM internal token." })
    updateConfig(@Param("id") id: string, @Body() body: KapsoCronjobConfigBodyDto): Promise<KapsoCronjobConfigDto> {
        return this.service.updateConfig(id, body);
    }

    @Post("cronjob-configs/:cronjobConfigId/projects")
    @ApiOperation({ summary: "Assign one CRM project scope to a Kapso cronjob." })
    @ApiParam({ name: "cronjobConfigId" })
    @ApiBody({
        schema: {
            properties: {
                config: { example: {}, type: "object" },
                idnetsuiteAdmin: { example: 653055, nullable: true, type: "number" },
                idproyectoLead: { example: 38, type: "number" },
                isActive: { example: true, type: "boolean" },
                kapsoIntegracionNumeroWhatsappId: { example: "1", type: "string" },
            },
            required: ["kapsoIntegracionNumeroWhatsappId", "idproyectoLead", "isActive"],
            type: "object",
        },
    })
    @ApiCreatedResponse({ description: "Kapso cronjob project config created." })
    @ApiConflictResponse({ description: "Cronjob project config already exists." })
    @ApiNotFoundResponse({
        description: "Cronjob, integration, admin assignment, or project not found.",
    })
    @ApiUnauthorizedResponse({ description: "Invalid CRM internal token." })
    createProjectConfig(@Param("cronjobConfigId") cronjobConfigId: string, @Body() body: KapsoCronjobProjectConfigBodyDto): Promise<KapsoCronjobProjectConfigDto> {
        return this.service.createProjectConfig(cronjobConfigId, body);
    }

    @Patch("cronjob-project-configs/:id")
    @ApiOperation({ summary: "Update one CRM project scope from a Kapso cronjob." })
    @ApiParam({ name: "id" })
    @ApiOkResponse({ description: "Kapso cronjob project config updated." })
    @ApiConflictResponse({ description: "Cronjob project config already exists." })
    @ApiNotFoundResponse({
        description: "Cronjob project config, integration, admin, or project not found.",
    })
    @ApiUnauthorizedResponse({ description: "Invalid CRM internal token." })
    updateProjectConfig(@Param("id") id: string, @Body() body: KapsoCronjobProjectConfigBodyDto): Promise<KapsoCronjobProjectConfigDto> {
        return this.service.updateProjectConfig(id, body);
    }

    @Delete("cronjob-project-configs/:id")
    @HttpCode(200)
    @ApiOperation({ summary: "Delete one CRM project scope from a Kapso cronjob." })
    @ApiParam({ name: "id" })
    @ApiOkResponse({ description: "Kapso cronjob project config deleted." })
    @ApiNotFoundResponse({ description: "Cronjob project config not found." })
    @ApiUnauthorizedResponse({ description: "Invalid CRM internal token." })
    deleteProjectConfig(@Param("id") id: string): Promise<{ readonly deleted: boolean }> {
        return this.service.deleteProjectConfig(id);
    }
}
