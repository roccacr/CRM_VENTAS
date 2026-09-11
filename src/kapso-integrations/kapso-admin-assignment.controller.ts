import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiConflictResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags, ApiUnauthorizedResponse } from "@nestjs/swagger";

import { CrmInternalTokenGuard } from "../auth/crm-internal-token.guard";
import { isTruthyQueryFlag } from "./is-truthy-query-flag";
import { CreateKapsoAdminAssignmentBodyDto, KapsoAdminAssignmentBodyDto } from "./kapso-admin-assignment.dto";
import { KapsoAdminAssignmentService, KapsoAdminIntegrationDto, KapsoAdminOptionDto, KapsoAdminAssignmentDto } from "./kapso-admin-assignment.service";
import { toDataEnvelope } from "./to-data-envelope";

/**
 * Endpoints internos del CRM para administrar la relacion integracion Kapso -> admin CRM.
 */
@ApiTags("Kapso admin assignments")
@ApiBearerAuth()
@UseGuards(CrmInternalTokenGuard)
@Controller("kapso")
export class KapsoAdminAssignmentController {
    constructor(private readonly service: KapsoAdminAssignmentService) {}

    @Get("admins/options")
    @ApiOperation({ summary: "List active CRM admins available for Kapso assignment." })
    @ApiQuery({ name: "search", required: false })
    @ApiQuery({ name: "includeInactive", required: false })
    @ApiOkResponse({ description: "CRM admins listed." })
    @ApiUnauthorizedResponse({ description: "Invalid CRM internal token." })
    listAdmins(@Query("search") search?: string, @Query("includeInactive") includeInactive?: string): Promise<{ data: KapsoAdminOptionDto[] }> {
        return this.service.listAdminOptions(search ?? "", isTruthyQueryFlag(includeInactive)).then(toDataEnvelope);
    }

    @Get("phone-numbers/options")
    @ApiOperation({ summary: "List Kapso WhatsApp integrations available for assignment." })
    @ApiQuery({ name: "search", required: false })
    @ApiQuery({ name: "includeInactive", required: false })
    @ApiOkResponse({ description: "Kapso integrations listed." })
    @ApiUnauthorizedResponse({ description: "Invalid CRM internal token." })
    listPhoneNumbers(@Query("search") search?: string, @Query("includeInactive") includeInactive?: string): Promise<{ data: KapsoAdminIntegrationDto[] }> {
        return this.service.listPhoneNumberOptions(search ?? "", isTruthyQueryFlag(includeInactive)).then(toDataEnvelope);
    }

    @Get("admin-integrations")
    @ApiOperation({ summary: "List Kapso integrations with assigned CRM admins." })
    @ApiQuery({ name: "search", required: false })
    @ApiQuery({ name: "includeInactive", required: false })
    @ApiOkResponse({ description: "Assignment view listed." })
    @ApiUnauthorizedResponse({ description: "Invalid CRM internal token." })
    listAssignments(@Query("search") search?: string, @Query("includeInactive") includeInactive?: string): Promise<{ data: KapsoAdminIntegrationDto[] }> {
        return this.service.listAdminIntegrations(search ?? "", isTruthyQueryFlag(includeInactive)).then(toDataEnvelope);
    }

    @Post("admin-integrations")
    @ApiOperation({ summary: "Assign one CRM admin to one Kapso WhatsApp integration." })
    @ApiBody({
        schema: {
            properties: {
                idnetsuiteAdmin: { example: 123456, type: "number" },
                kapsoIntegracionNumeroWhatsappId: { example: "1", type: "string" },
            },
            required: ["kapsoIntegracionNumeroWhatsappId", "idnetsuiteAdmin"],
            type: "object",
        },
    })
    @ApiCreatedResponse({ description: "Assignment created." })
    @ApiConflictResponse({ description: "Admin is already assigned to this integration." })
    @ApiNotFoundResponse({ description: "Integration or active admin not found." })
    @ApiUnauthorizedResponse({ description: "Invalid CRM internal token." })
    createAssignment(@Body() body: CreateKapsoAdminAssignmentBodyDto): Promise<KapsoAdminAssignmentDto> {
        return this.service.createAssignment(body.kapsoIntegracionNumeroWhatsappId, body.idnetsuiteAdmin);
    }

    @Patch("admin-integrations/:id")
    @ApiOperation({ summary: "Change the CRM admin assigned in an existing Kapso assignment." })
    @ApiParam({ name: "id" })
    @ApiOkResponse({ description: "Assignment updated." })
    @ApiConflictResponse({ description: "Admin is already assigned to this integration." })
    @ApiNotFoundResponse({ description: "Assignment or active admin not found." })
    @ApiUnauthorizedResponse({ description: "Invalid CRM internal token." })
    updateAssignment(@Param("id") id: string, @Body() body: KapsoAdminAssignmentBodyDto): Promise<KapsoAdminAssignmentDto> {
        return this.service.updateAssignment(id, body.idnetsuiteAdmin);
    }

    @Delete("admin-integrations/:id")
    @HttpCode(200)
    @ApiOperation({ summary: "Delete one CRM admin assignment from a Kapso integration." })
    @ApiParam({ name: "id" })
    @ApiOkResponse({ description: "Assignment deleted." })
    @ApiNotFoundResponse({ description: "Assignment not found." })
    @ApiUnauthorizedResponse({ description: "Invalid CRM internal token." })
    deleteAssignment(@Param("id") id: string): Promise<{ readonly deleted: boolean }> {
        return this.service.deleteAssignment(id);
    }
}
