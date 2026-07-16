// ============================================================================
// IMPORTS
// ============================================================================

import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";

import { ListAdminKapsoIntegrationsDto } from "../dto/list-admin-kapso-integrations.dto";
import { SaveAdminKapsoIntegrationDto } from "../dto/save-admin-kapso-integration.dto";
import { UpdateAdminKapsoIntegrationStatusDto } from "../dto/update-admin-kapso-integration-status.dto";
import { AdminKapsoIntegrationsService } from "../services/admin-kapso-integrations.service";

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
