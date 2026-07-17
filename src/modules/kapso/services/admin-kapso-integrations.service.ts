// ============================================================================
// IMPORTS
// ============================================================================

import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import { basename, dirname, extname, isAbsolute, join, resolve } from "path";

import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { ListAdminKapsoIntegrationsDto } from "../dto/list-admin-kapso-integrations.dto";
import { SaveAdminKapsoIntegrationDto } from "../dto/save-admin-kapso-integration.dto";
import { UpdateAdminKapsoIntegrationStatusDto } from "../dto/update-admin-kapso-integration-status.dto";
import { AdminKapsoIntegrationStatus } from "../entities/admin-kapso-integration.entity";
import { AdminKapsoIntegrationsRepository, FlowProjectMediaRecord } from "../repositories/admin-kapso-integrations.repository";

// ============================================================================
// TIPOS LOCALES
// ============================================================================

type UploadedKapsoMediaFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

type MediaFileType = "image" | "video" | "document";

type KapsoMediaFileResponse = {
  absolutePath: string;
  mimeType: string;
  originalName: string;
};

const DEFAULT_INTRO_STEP_CODE = "intro";

// ============================================================================
// SERVICIO
// ============================================================================

/**
 * Reglas de negocio del modulo de asignacion admin–Kapso.
 *
 * Responsabilidades:
 * - validar existencia de admin e integracion;
 * - bloquear duplicados;
 * - impedir nuevas relaciones sobre integraciones inactivas;
 * - exponer listados y resolucion operativa por administrador.
 */
@Injectable()
export class AdminKapsoIntegrationsService {
  constructor(
    private readonly repository: AdminKapsoIntegrationsRepository,
    private readonly configService: ConfigService,
  ) {}

  // --------------------------------------------------------------------------
  // OPCIONES DE FORMULARIO
  // --------------------------------------------------------------------------

  async listAdministratorOptions(search?: string, includeInactive?: boolean) {
    return this.repository.listAdminOptions({
      search,
      includeInactive,
    });
  }

  async listKapsoIntegrationOptions(search?: string, includeInactive?: boolean) {
    return this.repository.listKapsoPhoneNumberOptions({
      search,
      includeInactive,
    });
  }

  async listProjectOptions(search?: string, includeInactive?: boolean) {
    return this.repository.listProjectOptions({
      search,
      includeInactive,
    });
  }

  async listBusinessFlows() {
    return this.repository.listBusinessFlows();
  }

  async enableBusinessFlowProject(flowUuid: string, idProyecto: number) {
    const project = await this.repository.enableBusinessFlowProject(flowUuid, idProyecto);

    if (!project) {
      throw new NotFoundException("El proyecto indicado no existe.");
    }

    return project;
  }

  async disableBusinessFlowProject(flowUuid: string, idProyecto: number) {
    return this.repository.disableBusinessFlowProject(flowUuid, idProyecto);
  }

  // --------------------------------------------------------------------------
  // ADJUNTOS POR FLUJO Y PROYECTO
  // --------------------------------------------------------------------------

  async listFlowProjectMedia(flowUuid: string, idProyectoNetsuite: number, stepCode = DEFAULT_INTRO_STEP_CODE) {
    const mediaItems = await this.repository.listFlowProjectMedia(flowUuid, idProyectoNetsuite, stepCode);
    const availableMediaItems: FlowProjectMediaRecord[] = [];

    for (const media of mediaItems) {
      if (await this.mediaFileExists(media)) {
        availableMediaItems.push(media);
      } else {
        await this.repository.deactivateFlowProjectMedia(media.id);
      }
    }

    return availableMediaItems;
  }

  async uploadFlowProjectMedia(
    flowUuid: string,
    idProyectoNetsuite: number,
    file: UploadedKapsoMediaFile | undefined,
    options?: { stepCode?: string; sortOrder?: number },
  ) {
    if (!file) {
      throw new BadRequestException("Debe adjuntar un archivo.");
    }

    const mediaType = this.resolveMediaType(file.mimetype);
    const maxFileSizeBytes = this.configService.get<number>("kapso.mediaMaxFileSizeBytes") ?? 50 * 1024 * 1024;
    const sortOrder = Number.isFinite(options?.sortOrder) ? Number(options?.sortOrder) : 0;

    if (file.size > maxFileSizeBytes) {
      throw new BadRequestException("El archivo supera el tamano maximo permitido.");
    }

    const stepCode = this.normalizeStepCode(options?.stepCode);
    const project = await this.repository.findBusinessFlowProject(flowUuid, idProyectoNetsuite);

    if (!project || project.enabled !== 1) {
      throw new NotFoundException("El proyecto debe estar habilitado en el flujo antes de subir adjuntos.");
    }

    const storedFilename = `${randomUUID()}${extname(file.originalname).toLowerCase() || ".bin"}`;
    const projectFolderName = this.buildProjectMediaFolderName(idProyectoNetsuite, project.nombreProyecto ?? project.projectName);
    const relativePath = join(flowUuid, "proyectos", projectFolderName, storedFilename).replace(/\\/g, "/");
    const absolutePath = this.resolveStoragePath(relativePath);

    await fs.mkdir(dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, file.buffer);

    const publicBaseUrl = this.configService.getOrThrow<string>("kapso.publicBaseUrl").replace(/\/+$/, "");
    const apiPrefix = this.configService.getOrThrow<string>("app.apiPrefix").replace(/^\/+|\/+$/g, "");
    const publicUrl = `${publicBaseUrl}/${apiPrefix}/kapso/media/${storedFilename}`;

    return this.repository.createFlowProjectMedia({
      flowUuid,
      idProyectoNetsuite,
      stepCode,
      mediaType,
      originalName: file.originalname,
      storedFilename,
      relativePath,
      publicUrl,
      mimeType: file.mimetype,
      fileSize: file.size,
      sortOrder,
    });
  }

  async deleteFlowProjectMedia(id: number) {
    const media = await this.repository.deactivateFlowProjectMedia(id);

    if (!media) {
      throw new NotFoundException("El adjunto indicado no existe.");
    }

    return media;
  }

  async getMediaFileByStoredFilename(storedFilename: string): Promise<KapsoMediaFileResponse> {
    if (storedFilename !== basename(storedFilename) || !/^[a-zA-Z0-9._-]+$/.test(storedFilename)) {
      throw new BadRequestException("Nombre de archivo invalido.");
    }

    const media = await this.repository.findFlowProjectMediaByStoredFilename(storedFilename);

    if (!media) {
      throw new NotFoundException("El adjunto indicado no existe.");
    }

    if (!(await this.mediaFileExists(media))) {
      await this.repository.deactivateFlowProjectMedia(media.id);
      throw new NotFoundException("El archivo fisico del adjunto ya no existe.");
    }

    return {
      absolutePath: this.resolveStoragePath(media.relativePath),
      mimeType: media.mimeType,
      originalName: media.originalName,
    };
  }

  // --------------------------------------------------------------------------
  // CRUD DE RELACIONES
  // --------------------------------------------------------------------------

  async createRelation(dto: SaveAdminKapsoIntegrationDto) {
    await this.assertValidAdministrator(dto.idnetsuiteAdmin);
    await this.assertValidKapsoPhoneNumber(dto.kapsoPhoneNumberId);
    await this.assertNoDuplicate(dto.idnetsuiteAdmin, dto.kapsoPhoneNumberId);

    const relation = await this.repository.createRelation({
      idnetsuiteAdmin: dto.idnetsuiteAdmin,
      kapsoPhoneNumberId: dto.kapsoPhoneNumberId,
      status: dto.status as AdminKapsoIntegrationStatus,
    });

    return this.getRelationById(relation.id);
  }

  async listRelations(query: ListAdminKapsoIntegrationsDto) {
    return this.repository.listRelations(query);
  }

  async getRelationById(id: number) {
    const relation = await this.repository.findRelationDetailById(id);

    if (!relation) {
      throw new NotFoundException("La relacion admin–Kapso no existe.");
    }

    return relation;
  }

  async updateRelation(id: number, dto: SaveAdminKapsoIntegrationDto) {
    const relation = await this.repository.findRelationById(id);

    if (!relation) {
      throw new NotFoundException("La relacion admin–Kapso no existe.");
    }

    await this.assertValidAdministrator(dto.idnetsuiteAdmin);
    await this.assertValidKapsoPhoneNumber(dto.kapsoPhoneNumberId);
    await this.assertNoDuplicate(dto.idnetsuiteAdmin, dto.kapsoPhoneNumberId, id);

    await this.repository.updateRelation(relation, {
      idnetsuiteAdmin: dto.idnetsuiteAdmin,
      kapsoPhoneNumberId: dto.kapsoPhoneNumberId,
      status: dto.status as AdminKapsoIntegrationStatus,
    });

    return this.getRelationById(id);
  }

  async updateRelationStatus(id: number, dto: UpdateAdminKapsoIntegrationStatusDto) {
    const relation = await this.repository.findRelationById(id);

    if (!relation) {
      throw new NotFoundException("La relacion admin–Kapso no existe.");
    }

    await this.repository.updateRelationStatus(relation, dto.status as AdminKapsoIntegrationStatus);
    return this.getRelationById(id);
  }

  async deleteRelation(id: number) {
    const relation = await this.repository.findRelationById(id);

    if (!relation) {
      throw new NotFoundException("La relacion admin–Kapso no existe.");
    }

    await this.repository.deleteRelation(relation);

    return {
      ok: true,
      id,
      message: "La relacion admin–Kapso fue eliminada.",
    };
  }

  // --------------------------------------------------------------------------
  // USO OPERATIVO
  // --------------------------------------------------------------------------

  async listActiveIntegrationsByAdmin(idnetsuiteAdmin: number) {
    await this.assertAdministratorExists(idnetsuiteAdmin);

    return this.repository.listActiveIntegrationsByAdmin(idnetsuiteAdmin);
  }

  // --------------------------------------------------------------------------
  // VALIDACIONES
  // --------------------------------------------------------------------------

  private async assertAdministratorExists(idnetsuiteAdmin: number) {
    const administrator = await this.repository.findAdminOptionByNetSuiteId(idnetsuiteAdmin);

    if (!administrator) {
      throw new NotFoundException("El administrador indicado no existe.");
    }

    return administrator;
  }

  private async assertValidAdministrator(idnetsuiteAdmin: number) {
    const administrator = await this.assertAdministratorExists(idnetsuiteAdmin);

    if (administrator.status !== 1) {
      throw new BadRequestException("El administrador indicado esta inactivo y no puede recibir nuevas asignaciones.");
    }

    return administrator;
  }

  private async assertValidKapsoPhoneNumber(kapsoPhoneNumberId: number) {
    const integration = await this.repository.findKapsoPhoneNumberOptionById(kapsoPhoneNumberId);

    if (!integration) {
      throw new NotFoundException("La integracion Kapso indicada no existe.");
    }

    if (!integration.active) {
      throw new BadRequestException("La integracion Kapso indicada esta inactiva y no puede asignarse.");
    }

    return integration;
  }

  private async assertNoDuplicate(idnetsuiteAdmin: number, kapsoPhoneNumberId: number, excludeId?: number) {
    const duplicate = await this.repository.findDuplicateRelation(idnetsuiteAdmin, kapsoPhoneNumberId, excludeId);

    if (duplicate) {
      throw new ConflictException("Ese administrador ya esta asignado a la integracion Kapso seleccionada.");
    }
  }

  private resolveMediaType(mimeType: string): MediaFileType {
    if (mimeType.startsWith("image/")) {
      return "image";
    }

    if (mimeType.startsWith("video/")) {
      return "video";
    }

    if (mimeType === "application/pdf") {
      return "document";
    }

    throw new BadRequestException("Solo se permiten imagenes, videos o PDF.");
  }

  private normalizeStepCode(stepCode?: string) {
    const normalized = (stepCode || DEFAULT_INTRO_STEP_CODE).trim().toLowerCase();

    if (!/^[a-z0-9_-]+$/.test(normalized)) {
      throw new BadRequestException("El codigo del paso contiene caracteres invalidos.");
    }

    return normalized;
  }

  private buildProjectMediaFolderName(idProyectoNetsuite: number, projectName: string | null) {
    const safeName =
      (projectName || "proyecto")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "proyecto";

    return `${idProyectoNetsuite}-${safeName}`;
  }

  private async mediaFileExists(media: Pick<FlowProjectMediaRecord, "relativePath">) {
    try {
      await fs.access(this.resolveStoragePath(media.relativePath));
      return true;
    } catch {
      return false;
    }
  }

  private resolveStoragePath(relativePath: string) {
    const configuredStoragePath = this.configService.get<string>("kapso.mediaStoragePath") ?? "archivos";
    const storageRoot = isAbsolute(configuredStoragePath) ? configuredStoragePath : resolve(process.cwd(), configuredStoragePath);
    const absolutePath = resolve(storageRoot, relativePath);

    if (absolutePath !== storageRoot && !absolutePath.startsWith(`${storageRoot}\\`) && !absolutePath.startsWith(`${storageRoot}/`)) {
      throw new BadRequestException("Ruta de archivo invalida.");
    }

    return absolutePath;
  }
}
