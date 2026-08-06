/**
 * Controlador HTTP de administración Kapso: relaciones admin–número, flujos de negocio y media.
 *
 * Todas las rutas (salvo descarga de media firmada) exigen rol CRM 1 porque mutan
 * configuración operativa y asignaciones comerciales. El endpoint de media es `@Public`
 * pero se protege con URL firmada HMAC + TTL para que WhatsApp/CRM puedan leer adjuntos
 * sin JWT, sin exponer el storage de forma indefinida.
 */

import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";

import { Public, RequireCrmRoles } from "../../../common/auth/auth.decorators";
import { ListAdminKapsoIntegrationsDto } from "../dto/list-admin-kapso-integrations.dto";
import { SaveAdminKapsoIntegrationDto } from "../dto/save-admin-kapso-integration.dto";
import { UpdateAdminKapsoIntegrationStatusDto } from "../dto/update-admin-kapso-integration-status.dto";
import { AdminKapsoIntegrationsService } from "../services/admin-kapso-integrations.service";

type UploadedKapsoMediaFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

/**
 * API de administración bajo `/kapso/*` para el panel CRM.
 *
 * Centraliza catálogos, CRUD de asignaciones admin↔Kapso, habilitación de flujos/proyectos
 * y gestión de adjuntos usados en automatización de leads.
 */
@Controller("kapso")
@RequireCrmRoles(1)
export class AdminKapsoIntegrationsController {
  constructor(private readonly service: AdminKapsoIntegrationsService) {}

  /**
   * Lista administradores NetSuite elegibles para asignar a un número Kapso.
   *
   * @param query - Filtro de búsqueda y flag para incluir inactivos en el selector.
   */
  @Get("admins/options")
  listAdministratorOptions(@Query() query: ListAdminKapsoIntegrationsDto) {
    return this.service.listAdministratorOptions(query.search, query.includeInactive === 1);
  }

  /**
   * Lista números/integraciones Kapso disponibles para el selector de asignación.
   *
   * @param query - Filtro de búsqueda y flag para incluir inactivos.
   */
  @Get("phone-numbers/options")
  listKapsoIntegrationOptions(@Query() query: ListAdminKapsoIntegrationsDto) {
    return this.service.listKapsoIntegrationOptions(query.search, query.includeInactive === 1);
  }

  /**
   * Lista proyectos CRM disponibles para habilitar dentro de un flujo de negocio Kapso.
   *
   * @param query - Filtro de búsqueda y flag para incluir inactivos.
   */
  @Get("projects/options")
  listProjectOptions(@Query() query: ListAdminKapsoIntegrationsDto) {
    return this.service.listProjectOptions(query.search, query.includeInactive === 1);
  }

  /**
   * Devuelve los flujos de negocio Kapso con su estado y proyectos asociados.
   * Sirve al panel para decidir qué automatizaciones están activas.
   */
  @Get("business-flows")
  listBusinessFlows() {
    return this.service.listBusinessFlows();
  }

  /**
   * Activa o desactiva un flujo de negocio completo.
   * Un flujo inactivo debe dejar de participar en workers de plantillas/automatización.
   *
   * @param flowUuid - UUID del flujo de negocio.
   * @param enabled - Valor crudo del body; el service valida 0/1/boolean.
   */
  @Patch("business-flows/:flowUuid/status")
  updateBusinessFlowStatus(@Param("flowUuid") flowUuid: string, @Body("enabled") enabled: unknown) {
    return this.service.updateBusinessFlowStatus(flowUuid, enabled);
  }

  /**
   * Habilita un proyecto CRM dentro de un flujo (permite media y plantillas de ese proyecto).
   *
   * @param flowUuid - UUID del flujo.
   * @param idProyecto - Id NetSuite del proyecto.
   */
  @Post("business-flows/:flowUuid/projects")
  enableBusinessFlowProject(@Param("flowUuid") flowUuid: string, @Body("idProyecto", ParseIntPipe) idProyecto: number) {
    return this.service.enableBusinessFlowProject(flowUuid, idProyecto);
  }

  /**
   * Actualiza mensaje y botones de intro para un proyecto ya habilitado en el flujo.
   *
   * @param flowUuid - UUID del flujo.
   * @param idProyecto - Id NetSuite del proyecto.
   * @param body - Mensaje y labels visibles de los botones.
   */
  @Patch("business-flows/:flowUuid/projects/:idProyecto/intro-config")
  updateBusinessFlowProjectIntroConfig(
    @Param("flowUuid") flowUuid: string,
    @Param("idProyecto", ParseIntPipe) idProyecto: number,
    @Body()
    body: {
      introMessageTemplate?: unknown;
      introOptions?: unknown;
    },
  ) {
    return this.service.updateBusinessFlowProjectIntroConfig(flowUuid, idProyecto, body);
  }

  /**
   * Retira un proyecto del flujo y limpia sus adjuntos sin borrar el flujo completo.
   *
   * @param flowUuid - UUID del flujo.
   * @param idProyecto - Id NetSuite del proyecto.
   */
  @Delete("business-flows/:flowUuid/projects/:idProyecto")
  disableBusinessFlowProject(@Param("flowUuid") flowUuid: string, @Param("idProyecto", ParseIntPipe) idProyecto: number) {
    return this.service.disableBusinessFlowProject(flowUuid, idProyecto);
  }

  /**
   * Lista adjuntos activos de un flujo/proyecto/paso, con URLs firmadas para consumo seguro.
   *
   * @param flowUuid - UUID del flujo.
   * @param idProyectoNetsuite - Id NetSuite del proyecto.
   * @param stepCode - Paso del flujo (por defecto `intro` en el service).
   */
  @Get("flows/:flowUuid/projects/:idProyectoNetsuite/media")
  listFlowProjectMedia(
    @Param("flowUuid") flowUuid: string,
    @Param("idProyectoNetsuite", ParseIntPipe) idProyectoNetsuite: number,
    @Query("stepCode") stepCode?: string,
  ) {
    return this.service.listFlowProjectMedia(flowUuid, idProyectoNetsuite, stepCode);
  }

  /**
   * Sube un adjunto al storage local y registra metadata en BD.
   *
   * Throttle estricto (10/min) porque escribe disco, valida magic bytes y puede
   * saturar I/O si se abusa desde el panel.
   *
   * @param flowUuid - UUID del flujo.
   * @param idProyectoNetsuite - Proyecto habilitado en el flujo.
   * @param file - Archivo multipart (`file`).
   * @param stepCode - Paso opcional del flujo.
   * @param sortOrder - Orden de presentación opcional.
   */
  @Post("flows/:flowUuid/projects/:idProyectoNetsuite/media")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
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

  /**
   * Desactiva y elimina físicamente un adjunto de flujo/proyecto.
   *
   * @param id - Id interno del registro de media.
   */
  @Delete("flow-project-media/:id")
  deleteFlowProjectMedia(@Param("id", ParseIntPipe) id: number) {
    return this.service.deleteFlowProjectMedia(id);
  }

  /**
   * Sirve un archivo de media por nombre almacenado.
   *
   * Es `@Public` a propósito: Meta/WhatsApp y el frontend CRM descargan por URL firmada
   * sin sesión JWT. La seguridad depende de `expires` + `signature` HMAC (TTL corto).
   * CORP `cross-origin` evita que Helmet bloquee la lectura cross-origin del adjunto.
   *
   * @param storedFilename - Nombre físico seguro del archivo.
   * @param expires - Epoch seconds de vencimiento de la firma.
   * @param signature - HMAC hex de `storedFilename.expires`.
   * @param response - Respuesta Express para `sendFile` binario.
   */
  @Get("media/:storedFilename")
  @Public()
  async getMediaFile(
    @Param("storedFilename") storedFilename: string,
    @Query("expires") expires: string | undefined,
    @Query("signature") signature: string | undefined,
    @Res() response: Response,
  ) {
    this.service.assertMediaUrlValid(storedFilename, expires, signature);
    const media = await this.service.getMediaFileByStoredFilename(storedFilename);

    // Los adjuntos se muestran en el CRM desde otro origen/puerto en desarrollo
    // y desde el dominio del frontend en producción; CORP evita que Helmet
    // bloquee la carga cross-origin del recurso.
    response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    response.type(media.mimeType);
    return response.sendFile(media.absolutePath, {
      headers: {
        "Content-Disposition": `inline; filename="${media.originalName.replace(/"/g, "")}"`,
      },
    });
  }

  /**
   * Crea una relación admin NetSuite ↔ número Kapso.
   *
   * @param dto - Payload de creación (admin, phoneNumberId local, status).
   */
  @Post("admin-integrations")
  createRelation(@Body() dto: SaveAdminKapsoIntegrationDto) {
    return this.service.createRelation(dto);
  }

  /**
   * Lista relaciones admin–Kapso con filtros/paginación del DTO.
   *
   * @param query - Criterios de listado.
   */
  @Get("admin-integrations")
  listRelations(@Query() query: ListAdminKapsoIntegrationsDto) {
    return this.service.listRelations(query);
  }

  /**
   * Obtiene el detalle de una relación por id interno.
   *
   * @param id - Id de la relación.
   */
  @Get("admin-integrations/:id")
  getRelationById(@Param("id", ParseIntPipe) id: number) {
    return this.service.getRelationById(id);
  }

  /**
   * Actualiza admin, número Kapso y/o status de una relación existente.
   *
   * @param id - Id de la relación.
   * @param dto - Nuevos valores.
   */
  @Patch("admin-integrations/:id")
  updateRelation(@Param("id", ParseIntPipe) id: number, @Body() dto: SaveAdminKapsoIntegrationDto) {
    return this.service.updateRelation(id, dto);
  }

  /**
   * Cambia solo el status de una relación (activo/inactivo) sin reasignar entidades.
   *
   * @param id - Id de la relación.
   * @param dto - Nuevo status.
   */
  @Patch("admin-integrations/:id/status")
  updateRelationStatus(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateAdminKapsoIntegrationStatusDto) {
    return this.service.updateRelationStatus(id, dto);
  }

  /**
   * Elimina una relación admin–Kapso.
   *
   * @param id - Id de la relación.
   */
  @Delete("admin-integrations/:id")
  deleteRelation(@Param("id", ParseIntPipe) id: number) {
    return this.service.deleteRelation(id);
  }

  /**
   * Lista integraciones Kapso activas asignadas a un administrador NetSuite.
   * Útil para el CRM al elegir desde qué número enviar/atender.
   *
   * @param idnetsuiteAdmin - Id NetSuite del administrador.
   */
  @Get("admins/:idnetsuiteAdmin/integrations")
  listActiveIntegrationsByAdmin(@Param("idnetsuiteAdmin", ParseIntPipe) idnetsuiteAdmin: number) {
    return this.service.listActiveIntegrationsByAdmin(idnetsuiteAdmin);
  }
}
