// ============================================================================
// IMPORTS
// ============================================================================

import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";

import { ListAdminKapsoIntegrationsDto } from "../dto/list-admin-kapso-integrations.dto";
import { SaveAdminKapsoIntegrationDto } from "../dto/save-admin-kapso-integration.dto";
import { UpdateAdminKapsoIntegrationStatusDto } from "../dto/update-admin-kapso-integration-status.dto";
import { AdminKapsoIntegrationsService } from "../services/admin-kapso-integrations.service";

// ============================================================================
// TIPOS LOCALES
// ============================================================================

type UploadedKapsoMediaFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

// ============================================================================
// CONTROLADOR
// ============================================================================

/**
 * Superficie REST del modulo de asignaciones admin–Kapso.
 *
 * Todas las rutas cuelgan del mismo API Kapso ya usado por el frontend del CRM,
 * para evitar una segunda integracion HTTP o cambios de host/baseUrl.
 */
@Controller("kapso")
export class AdminKapsoIntegrationsController {
  constructor(private readonly service: AdminKapsoIntegrationsService) {}

  // --------------------------------------------------------------------------
  // OPCIONES PARA EL FRONTEND
  // --------------------------------------------------------------------------

  @Get("admins/options")
  listAdministratorOptions(@Query() query: ListAdminKapsoIntegrationsDto) {
    return this.service.listAdministratorOptions(query.search, query.includeInactive === 1);
  }

  @Get("phone-numbers/options")
  listKapsoIntegrationOptions(@Query() query: ListAdminKapsoIntegrationsDto) {
    return this.service.listKapsoIntegrationOptions(query.search, query.includeInactive === 1);
  }

  @Get("projects/options")
  listProjectOptions(@Query() query: ListAdminKapsoIntegrationsDto) {
    return this.service.listProjectOptions(query.search, query.includeInactive === 1);
  }

  @Get("business-flows")
  listBusinessFlows() {
    return this.service.listBusinessFlows();
  }

  @Post("business-flows/:flowUuid/projects")
  enableBusinessFlowProject(@Param("flowUuid") flowUuid: string, @Body("idProyecto", ParseIntPipe) idProyecto: number) {
    return this.service.enableBusinessFlowProject(flowUuid, idProyecto);
  }

  @Delete("business-flows/:flowUuid/projects/:idProyecto")
  disableBusinessFlowProject(@Param("flowUuid") flowUuid: string, @Param("idProyecto", ParseIntPipe) idProyecto: number) {
    return this.service.disableBusinessFlowProject(flowUuid, idProyecto);
  }

  // --------------------------------------------------------------------------
  // ADJUNTOS POR FLUJO Y PROYECTO
  // --------------------------------------------------------------------------

  @Get("flows/:flowUuid/projects/:idProyectoNetsuite/media")
  listFlowProjectMedia(
    @Param("flowUuid") flowUuid: string,
    @Param("idProyectoNetsuite", ParseIntPipe) idProyectoNetsuite: number,
    @Query("stepCode") stepCode?: string,
  ) {
    return this.service.listFlowProjectMedia(flowUuid, idProyectoNetsuite, stepCode);
  }

  @Post("flows/:flowUuid/projects/:idProyectoNetsuite/media")
  @UseInterceptors(FileInterceptor("file"))
  uploadFlowProjectMedia(
    @Param("flowUuid") flowUuid: string,
    @Param("idProyectoNetsuite", ParseIntPipe) idProyectoNetsuite: number,
    @UploadedFile() file: UploadedKapsoMediaFile,
    @Body("stepCode") stepCode?: string,
    @Body("sortOrder") sortOrder?: string,
  ) {
    return this.service.uploadFlowProjectMedia(flowUuid, idProyectoNetsuite, file, {
      stepCode,
      sortOrder: sortOrder === undefined ? undefined : Number(sortOrder),
    });
  }

  @Delete("flow-project-media/:id")
  deleteFlowProjectMedia(@Param("id", ParseIntPipe) id: number) {
    return this.service.deleteFlowProjectMedia(id);
  }

  @Get("media/:storedFilename")
  async getMediaFile(@Param("storedFilename") storedFilename: string, @Res() response: Response) {
    const media = await this.service.getMediaFileByStoredFilename(storedFilename);

    // Los adjuntos se muestran en el CRM desde otro origen/puerto durante desarrollo
    // y desde el dominio del frontend en produccion; este header evita que Helmet
    // bloquee imagenes/videos validos aunque el archivo responda 200 OK.
    response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    response.type(media.mimeType);
    return response.sendFile(media.absolutePath, {
      headers: {
        "Content-Disposition": `inline; filename="${media.originalName.replace(/"/g, "")}"`,
      },
    });
  }

  // --------------------------------------------------------------------------
  // CRUD DE RELACIONES
  // --------------------------------------------------------------------------

  @Post("admin-integrations")
  createRelation(@Body() dto: SaveAdminKapsoIntegrationDto) {
    return this.service.createRelation(dto);
  }

  @Get("admin-integrations")
  listRelations(@Query() query: ListAdminKapsoIntegrationsDto) {
    return this.service.listRelations(query);
  }

  @Get("admin-integrations/:id")
  getRelationById(@Param("id", ParseIntPipe) id: number) {
    return this.service.getRelationById(id);
  }

  @Patch("admin-integrations/:id")
  updateRelation(@Param("id", ParseIntPipe) id: number, @Body() dto: SaveAdminKapsoIntegrationDto) {
    return this.service.updateRelation(id, dto);
  }

  @Patch("admin-integrations/:id/status")
  updateRelationStatus(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateAdminKapsoIntegrationStatusDto) {
    return this.service.updateRelationStatus(id, dto);
  }

  @Delete("admin-integrations/:id")
  deleteRelation(@Param("id", ParseIntPipe) id: number) {
    return this.service.deleteRelation(id);
  }

  // --------------------------------------------------------------------------
  // RESOLUCION OPERATIVA
  // --------------------------------------------------------------------------

  @Get("admins/:idnetsuiteAdmin/integrations")
  listActiveIntegrationsByAdmin(@Param("idnetsuiteAdmin", ParseIntPipe) idnetsuiteAdmin: number) {
    return this.service.listActiveIntegrationsByAdmin(idnetsuiteAdmin);
  }
}
