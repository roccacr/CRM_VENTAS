import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags, ApiUnauthorizedResponse } from "@nestjs/swagger";

import { CrmInternalTokenGuard } from "../auth/crm-internal-token.guard";
import { KapsoProjectAssignmentService, KapsoProjectOptionDto } from "./kapso-project-assignment.service";
import { toDataEnvelope } from "./to-data-envelope";

/** Endpoint interno para poblar selectores de proyectos CRM en configuracion Kapso. */
@ApiTags("Kapso project options")
@ApiBearerAuth()
@UseGuards(CrmInternalTokenGuard)
@Controller("kapso")
export class KapsoProjectAssignmentController {
    constructor(private readonly service: KapsoProjectAssignmentService) {}

    @Get("projects/options")
    @ApiOperation({ summary: "List CRM projects available for Kapso cronjob config." })
    @ApiQuery({ name: "search", required: false })
    @ApiQuery({ name: "idnetsuiteAdmin", required: false })
    @ApiOkResponse({ description: "CRM projects listed." })
    @ApiUnauthorizedResponse({ description: "Invalid CRM internal token." })
    listProjects(@Query("search") search?: string, @Query("idnetsuiteAdmin") idnetsuiteAdmin?: string): Promise<{ data: KapsoProjectOptionDto[] }> {
        const parsedAdmin = idnetsuiteAdmin ? Number(idnetsuiteAdmin) : undefined;

        return this.service.listProjectOptions(search ?? "", Number.isFinite(parsedAdmin) ? parsedAdmin : undefined).then(toDataEnvelope);
    }
}
