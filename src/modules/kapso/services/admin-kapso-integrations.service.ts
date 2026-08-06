/**
 * Servicio de administración Kapso: relaciones admin–número, flujos y media de proyectos.
 *
 * Encapsula validaciones de negocio (admin activo, número activo, sin duplicados),
 * almacenamiento de adjuntos con sniffing de magic bytes (no confía en mimetype del cliente)
 * y URLs firmadas para servir media en un endpoint público con TTL.
 */

import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import { basename, dirname, isAbsolute, join, resolve } from "path";

import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { ListAdminKapsoIntegrationsDto } from "../dto/list-admin-kapso-integrations.dto";
import { SaveAdminKapsoIntegrationDto } from "../dto/save-admin-kapso-integration.dto";
import { UpdateAdminKapsoIntegrationStatusDto } from "../dto/update-admin-kapso-integration-status.dto";
import { AdminKapsoIntegrationStatus } from "../entities/admin-kapso-integration.entity";
import { AdminKapsoIntegrationsRepository } from "../repositories/admin-kapso-integrations.repository";
import { FlowProjectMediaRecord, KapsoFlowProjectMediaRepository } from "../repositories/kapso-flow-project-media.repository";
import { KapsoMediaUrlSignerService } from "./kapso-media-url-signer.service";

type UploadedKapsoMediaFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

type MediaFileType = "image" | "video" | "document";

type InspectedMediaFile = {
  extension: string;
  mediaType: MediaFileType;
  mimeType: string;
};

type KapsoMediaFileResponse = {
  absolutePath: string;
  mimeType: string;
  originalName: string;
};

const DEFAULT_INTRO_STEP_CODE = "intro";
const DEFAULT_INTRO_MESSAGE_TEMPLATE =
  "Perfecto {{nombre_lead}}, te comparto un video introductorio de {{proyecto_lead}} y algunas fotos.\n\n" +
  "¿Podrias contarme un poco sobre lo que estas buscando?";
const MAX_INTRO_OPTIONS = 3;
const WHATSAPP_VIDEO_MAX_FILE_SIZE_MB = 16;
const WHATSAPP_VIDEO_MAX_FILE_SIZE_BYTES = WHATSAPP_VIDEO_MAX_FILE_SIZE_MB * 1024 * 1024;
const DEFAULT_INTRO_OPTIONS = [
  { id: "intro_ver_precios", label: "Ver precios" },
  { id: "intro_agendar", label: "Agendar visita" },
  { id: "intro_asesor", label: "Hablar con asesor" },
];
const DEFAULT_INTRO_OPTION_MESSAGES: Record<string, string> = {
  intro_ver_precios: "Claro {{nombre_lead}}, te comparto la informacion de precios de {{proyecto_lead}}.",
  intro_agendar: "Perfecto {{nombre_lead}}, coordinemos una visita para que conozcas {{proyecto_lead}}.",
  intro_asesor: "Con gusto {{nombre_lead}}, un asesor continuara la conversacion contigo.",
};

type IntroOptionInput = {
  id?: unknown;
  label?: unknown;
  messageTemplate?: unknown;
};

/**
 * Orquestador de catálogos, CRUD de asignaciones y ciclo de vida de adjuntos de flujo.
 */
@Injectable()
export class AdminKapsoIntegrationsService {
  constructor(
    private readonly repository: AdminKapsoIntegrationsRepository,
    private readonly flowProjectMediaRepository: KapsoFlowProjectMediaRepository,
    private readonly configService: ConfigService,
    private readonly mediaUrlSigner: KapsoMediaUrlSignerService,
  ) {}

  /**
   * Opciones de administradores para selectores del panel.
   *
   * @param search - Texto libre opcional.
   * @param includeInactive - Si incluir administradores inactivos.
   */
  async listAdministratorOptions(search?: string, includeInactive?: boolean) {
    return this.repository.listAdminOptions({
      search,
      includeInactive,
    });
  }

  /**
   * Opciones de números Kapso para selectores del panel.
   *
   * @param search - Texto libre opcional.
   * @param includeInactive - Si incluir números inactivos.
   */
  async listKapsoIntegrationOptions(search?: string, includeInactive?: boolean) {
    return this.repository.listKapsoPhoneNumberOptions({
      search,
      includeInactive,
    });
  }

  /**
   * Opciones de proyectos CRM para habilitar en un flujo.
   *
   * @param search - Texto libre opcional.
   * @param includeInactive - Si incluir proyectos inactivos.
   */
  async listProjectOptions(search?: string, includeInactive?: boolean) {
    return this.flowProjectMediaRepository.listProjectOptions({
      search,
      includeInactive,
    });
  }

  /** Lista flujos de negocio con proyectos y estado de habilitación. */
  async listBusinessFlows() {
    return this.flowProjectMediaRepository.listBusinessFlows();
  }

  /**
   * Activa/desactiva un flujo. Solo acepta 0/1/boolean para evitar estados ambiguos.
   *
   * @param flowUuid - UUID del flujo.
   * @param enabled - Valor crudo del body.
   */
  async updateBusinessFlowStatus(flowUuid: string, enabled: unknown) {
    if (enabled !== 0 && enabled !== 1 && enabled !== true && enabled !== false) {
      throw new BadRequestException("El estado del flujo debe ser activo o inactivo.");
    }

    const nextEnabled = enabled === true || enabled === 1 ? 1 : 0;
    const result = await this.flowProjectMediaRepository.updateBusinessFlowStatus(flowUuid, nextEnabled);

    if (!result.ok) {
      throw new NotFoundException("El flujo indicado no existe.");
    }

    return result;
  }

  /**
   * Habilita un proyecto dentro de un flujo (precondición para subir media).
   *
   * @param flowUuid - UUID del flujo.
   * @param idProyecto - Id NetSuite del proyecto.
   */
  async enableBusinessFlowProject(flowUuid: string, idProyecto: number) {
    const project = await this.flowProjectMediaRepository.enableBusinessFlowProject(flowUuid, idProyecto);

    if (!project) {
      throw new NotFoundException("El proyecto indicado no existe.");
    }

    return project;
  }

  /**
   * Guarda el mensaje normal de intro y sus botones editables para un proyecto habilitado.
   *
   * Los ids de botones no se editan porque los webhooks los usan para continuar el flujo.
   *
   * @param flowUuid - UUID del flujo.
   * @param idProyecto - Id NetSuite del proyecto.
   * @param input - Mensaje y labels visibles configurados en CRM.
   */
  async updateBusinessFlowProjectIntroConfig(
    flowUuid: string,
    idProyecto: number,
    input: {
      introMessageTemplate?: unknown;
      introOptions?: unknown;
    },
  ) {
    const introMessageTemplate = this.normalizeIntroMessageTemplate(input.introMessageTemplate);
    const introOptionsJson = JSON.stringify(this.normalizeIntroOptions(input.introOptions));
    const project = await this.flowProjectMediaRepository.updateBusinessFlowProjectIntroConfig(
      flowUuid,
      idProyecto,
      introMessageTemplate,
      introOptionsJson,
    );

    if (!project || Number(project.enabled) !== 1) {
      throw new NotFoundException("El proyecto debe estar habilitado en el flujo antes de configurar la intro.");
    }

    return project;
  }

  /**
   * Retira un proyecto dentro de un flujo y limpia sus adjuntos.
   *
   * @param flowUuid - UUID del flujo.
   * @param idProyecto - Id NetSuite del proyecto.
   */
  async disableBusinessFlowProject(flowUuid: string, idProyecto: number) {
    const projects = await this.flowProjectMediaRepository.listBusinessFlowProjectsByIdentifier(flowUuid, idProyecto);
    const projectIds = [...new Set(projects.map((project) => project.idProyectoNetsuite))];
    const foldersToRemove = new Set<string>();
    let deletedMedia = 0;

    for (const idProyectoNetsuite of projectIds) {
      const mediaItems = await this.flowProjectMediaRepository.listFlowProjectMediaForProject(flowUuid, idProyectoNetsuite);

      for (const media of mediaItems) {
        foldersToRemove.add(dirname(media.relativePath).replace(/\\/g, "/"));
      }

      await this.collectProjectMediaFolders(flowUuid, idProyectoNetsuite, foldersToRemove);

      const mediaDeleteResult = await this.flowProjectMediaRepository.deleteFlowProjectMediaForProject(flowUuid, idProyectoNetsuite);
      deletedMedia += mediaDeleteResult.deletedMedia;
    }

    const projectDeleteResult = await this.flowProjectMediaRepository.deleteBusinessFlowProject(flowUuid, idProyecto);

    for (const folderRelativePath of foldersToRemove) {
      await fs.rm(this.resolveStoragePath(folderRelativePath), { recursive: true, force: true });
    }

    return {
      ...projectDeleteResult,
      deletedMedia,
    };
  }

  /**
   * Lista media activa de un flujo/proyecto/paso.
   * Si el archivo físico desapareció, desactiva el registro para no devolver links rotos
   * y regenera `publicUrl` firmada para los que sí existen.
   *
   * @param flowUuid - UUID del flujo.
   * @param idProyectoNetsuite - Id NetSuite del proyecto.
   * @param stepCode - Paso del flujo (default `intro`).
   */
  async listFlowProjectMedia(flowUuid: string, idProyectoNetsuite: number, stepCode = DEFAULT_INTRO_STEP_CODE) {
    const mediaItems = await this.flowProjectMediaRepository.listFlowProjectMedia(flowUuid, idProyectoNetsuite, stepCode);
    const availableMediaItems: FlowProjectMediaRecord[] = [];

    for (const media of mediaItems) {
      if (await this.mediaFileExists(media)) {
        availableMediaItems.push({
          ...media,
          publicUrl: this.mediaUrlSigner.createSignedUrl(media.storedFilename),
        });
      } else {
        await this.flowProjectMediaRepository.deactivateFlowProjectMedia(media.id);
      }
    }

    return availableMediaItems;
  }

  /**
   * Sube un adjunto: valida tamaño, sniffing de contenido, proyecto habilitado,
   * escribe a disco y persiste metadata. Si falla la BD, borra el archivo (compensación).
   *
   * @param flowUuid - UUID del flujo.
   * @param idProyectoNetsuite - Proyecto habilitado.
   * @param file - Archivo multipart en memoria.
   * @param options - `stepCode` y `sortOrder` opcionales.
   */
  async uploadFlowProjectMedia(
    flowUuid: string,
    idProyectoNetsuite: number,
    file: UploadedKapsoMediaFile | undefined,
    options?: { stepCode?: string; sortOrder?: number },
  ) {
    if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
      throw new BadRequestException("Debe adjuntar un archivo.");
    }

    const maxFileSizeBytes = this.configService.get<number>("kapso.mediaMaxFileSizeBytes") ?? 100 * 1024 * 1024;
    const sortOrder = Number.isFinite(options?.sortOrder) ? Number(options?.sortOrder) : 0;

    if (file.buffer.length > maxFileSizeBytes) {
      throw new BadRequestException("El archivo supera el tamano maximo permitido.");
    }

    const stepCode = this.normalizeStepCode(options?.stepCode);
    const project = await this.flowProjectMediaRepository.findBusinessFlowProject(flowUuid, idProyectoNetsuite);

    if (!project || project.enabled !== 1) {
      throw new NotFoundException("El proyecto debe estar habilitado en el flujo antes de subir adjuntos.");
    }

    const inspectedFile = this.inspectMediaFile(file.buffer);

    if (inspectedFile.mediaType === "video" && file.buffer.length > WHATSAPP_VIDEO_MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(`El video supera el limite permitido por WhatsApp/Kapso. Maximo: ${WHATSAPP_VIDEO_MAX_FILE_SIZE_MB} MB.`);
    }

    const storedFilename = `${randomUUID()}${inspectedFile.extension}`;
    const projectFolderName = this.buildProjectMediaFolderName(idProyectoNetsuite, project.nombreProyecto ?? project.projectName);
    const relativePath = join(flowUuid, "proyectos", projectFolderName, storedFilename).replace(/\\/g, "/");
    const absolutePath = this.resolveStoragePath(relativePath);

    await fs.mkdir(dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, file.buffer);

    const publicBaseUrl = this.configService.getOrThrow<string>("kapso.publicBaseUrl").replace(/\/+$/, "");
    const apiPrefix = this.configService.getOrThrow<string>("app.apiPrefix").replace(/^\/+|\/+$/g, "");
    const publicUrl = `${publicBaseUrl}/${apiPrefix}/kapso/media/${storedFilename}`;

    try {
      const created = await this.flowProjectMediaRepository.createFlowProjectMedia({
        flowUuid,
        idProyectoNetsuite,
        stepCode,
        mediaType: inspectedFile.mediaType,
        originalName: this.sanitizeOriginalFilename(file.originalname),
        storedFilename,
        relativePath,
        publicUrl,
        mimeType: inspectedFile.mimeType,
        fileSize: file.buffer.length,
        sortOrder,
      });

      if (!created) {
        throw new InternalServerErrorException("No se pudo persistir la metadata del archivo.");
      }

      return {
        ...created,
        publicUrl: this.mediaUrlSigner.createSignedUrl(created.storedFilename),
      };
    } catch (error) {
      // Compensación: si falla la metadata, no dejar basura en disco.
      await fs.rm(absolutePath, { force: true });
      throw error;
    }
  }

  /**
   * Soft-delete en BD y borrado físico del archivo.
   *
   * @param id - Id del registro de media.
   */
  async deleteFlowProjectMedia(id: number) {
    const media = await this.flowProjectMediaRepository.deactivateFlowProjectMedia(id);

    if (!media) {
      throw new NotFoundException("El adjunto indicado no existe.");
    }

    await fs.rm(this.resolveStoragePath(media.relativePath), { force: true });

    return media;
  }

  /**
   * Resuelve ruta absoluta y mime para servir un archivo por `storedFilename`.
   * Rechaza path traversal y nombres con caracteres peligrosos.
   *
   * @param storedFilename - Nombre físico seguro.
   */
  async getMediaFileByStoredFilename(storedFilename: string): Promise<KapsoMediaFileResponse> {
    if (storedFilename !== basename(storedFilename) || !/^[a-zA-Z0-9._-]+$/.test(storedFilename)) {
      throw new BadRequestException("Nombre de archivo invalido.");
    }

    const media = await this.flowProjectMediaRepository.findFlowProjectMediaByStoredFilename(storedFilename);

    if (!media) {
      throw new NotFoundException("El adjunto indicado no existe.");
    }

    if (!(await this.mediaFileExists(media))) {
      await this.flowProjectMediaRepository.deactivateFlowProjectMedia(media.id);
      throw new NotFoundException("El archivo fisico del adjunto ya no existe.");
    }

    return {
      absolutePath: this.resolveStoragePath(media.relativePath),
      mimeType: media.mimeType,
      originalName: media.originalName,
    };
  }

  /**
   * Valida la URL firmada (HMAC + TTL) antes de servir el archivo público.
   *
   * @param storedFilename - Nombre del archivo.
   * @param expires - Epoch seconds.
   * @param signature - Firma hex.
   */
  assertMediaUrlValid(storedFilename: string, expires: string | undefined, signature: string | undefined): void {
    this.mediaUrlSigner.assertValid(storedFilename, expires, signature);
  }

  /**
   * Crea relación admin↔Kapso tras validar entidades activas y unicidad.
   *
   * @param dto - Payload de creación.
   */
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

  /**
   * Lista relaciones con filtros del DTO.
   *
   * @param query - Criterios de listado.
   */
  async listRelations(query: ListAdminKapsoIntegrationsDto) {
    return this.repository.listRelations(query);
  }

  /**
   * Detalle de una relación o 404.
   *
   * @param id - Id interno.
   */
  async getRelationById(id: number) {
    const relation = await this.repository.findRelationDetailById(id);

    if (!relation) {
      throw new NotFoundException("La relacion admin–Kapso no existe.");
    }

    return relation;
  }

  /**
   * Actualiza una relación existente con las mismas validaciones que el create.
   *
   * @param id - Id interno.
   * @param dto - Nuevos valores.
   */
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

  /**
   * Cambia solo el status de la relación.
   *
   * @param id - Id interno.
   * @param dto - Nuevo status.
   */
  async updateRelationStatus(id: number, dto: UpdateAdminKapsoIntegrationStatusDto) {
    const relation = await this.repository.findRelationById(id);

    if (!relation) {
      throw new NotFoundException("La relacion admin–Kapso no existe.");
    }

    await this.repository.updateRelationStatus(relation, dto.status as AdminKapsoIntegrationStatus);
    return this.getRelationById(id);
  }

  /**
   * Elimina una relación admin–Kapso.
   *
   * @param id - Id interno.
   */
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

  /**
   * Integraciones activas de un administrador (para selección operativa en CRM).
   *
   * @param idnetsuiteAdmin - Id NetSuite del admin.
   */
  async listActiveIntegrationsByAdmin(idnetsuiteAdmin: number) {
    await this.assertAdministratorExists(idnetsuiteAdmin);

    return this.repository.listActiveIntegrationsByAdmin(idnetsuiteAdmin);
  }

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

  /**
   * Detecta tipo real por magic bytes (no confía en `file.mimetype` del cliente).
   * Evita subir ejecutables o polyglots disfrazados de imagen/PDF.
   */
  private inspectMediaFile(buffer: Buffer): InspectedMediaFile {
    const hasSignature = (signature: number[], offset = 0) =>
      buffer.length >= offset + signature.length && buffer.subarray(offset, offset + signature.length).equals(Buffer.from(signature));

    if (hasSignature([0xff, 0xd8, 0xff])) {
      return { extension: ".jpg", mediaType: "image", mimeType: "image/jpeg" };
    }

    if (hasSignature([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
      return { extension: ".png", mediaType: "image", mimeType: "image/png" };
    }

    const gifHeader = buffer.subarray(0, 6).toString("ascii");

    if (gifHeader === "GIF87a" || gifHeader === "GIF89a") {
      return { extension: ".gif", mediaType: "image", mimeType: "image/gif" };
    }

    if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
      return { extension: ".webp", mediaType: "image", mimeType: "image/webp" };
    }

    if (buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
      return { extension: ".pdf", mediaType: "document", mimeType: "application/pdf" };
    }

    if (buffer.subarray(4, 8).toString("ascii") === "ftyp") {
      const brand = buffer.subarray(8, 12).toString("ascii");

      if (brand === "qt  ") {
        return { extension: ".mov", mediaType: "video", mimeType: "video/quicktime" };
      }

      if (brand === "M4V " || brand === "M4VH" || brand === "M4VP") {
        return { extension: ".m4v", mediaType: "video", mimeType: "video/mp4" };
      }

      return { extension: ".mp4", mediaType: "video", mimeType: "video/mp4" };
    }

    if (hasSignature([0x1a, 0x45, 0xdf, 0xa3])) {
      return { extension: ".webm", mediaType: "video", mimeType: "video/webm" };
    }

    throw new BadRequestException("El contenido del archivo no corresponde a un formato permitido.");
  }

  /** Limpia control chars del nombre original (header Content-Disposition). */
  private sanitizeOriginalFilename(originalName: string): string {
    const sanitized = Array.from(basename(originalName))
      .filter((character) => {
        const codePoint = character.codePointAt(0) ?? 0;
        return codePoint >= 32 && codePoint !== 127;
      })
      .join("")
      .trim()
      .slice(0, 255);

    return sanitized || "archivo";
  }

  private normalizeStepCode(stepCode?: string) {
    const normalized = (stepCode || DEFAULT_INTRO_STEP_CODE).trim().toLowerCase();

    if (!/^[a-z0-9_-]+$/.test(normalized)) {
      throw new BadRequestException("El codigo del paso contiene caracteres invalidos.");
    }

    return normalized;
  }

  private normalizeIntroMessageTemplate(value: unknown) {
    const text = typeof value === "string" ? value.trim() : DEFAULT_INTRO_MESSAGE_TEMPLATE;

    if (!text) {
      throw new BadRequestException("El mensaje final de intro es requerido.");
    }

    if (text.length > 1024) {
      throw new BadRequestException("El mensaje final de intro no puede superar 1024 caracteres.");
    }

    return text;
  }

  private normalizeIntroOptions(value: unknown) {
    const options: IntroOptionInput[] = Array.isArray(value) && value.length > 0 ? (value as IntroOptionInput[]) : DEFAULT_INTRO_OPTIONS;

    if (options.length > MAX_INTRO_OPTIONS) {
      throw new BadRequestException("El mensaje de intro solo puede tener hasta 3 opciones.");
    }

    return options.map((option, index) => {
      const defaultOption = DEFAULT_INTRO_OPTIONS[index];
      const rawId = typeof option.id === "string" && option.id.trim() ? option.id.trim() : defaultOption?.id;
      const id =
        rawId
          ?.toLowerCase()
          .replace(/[^a-z0-9_-]/g, "_")
          .replace(/^_+|_+$/g, "") || `intro_option_${index + 1}`;

      const labelValue = option.label;
      const label = typeof labelValue === "string" && labelValue.trim() ? labelValue.trim() : defaultOption?.label || `Opcion ${index + 1}`;

      if (label.length > 25) {
        throw new BadRequestException(`La opcion ${index + 1} no puede superar 25 caracteres.`);
      }

      const rawMessageTemplate = option.messageTemplate;
      const messageTemplate =
        typeof rawMessageTemplate === "string" && rawMessageTemplate.trim()
          ? rawMessageTemplate.trim()
          : DEFAULT_INTRO_OPTION_MESSAGES[id] || (defaultOption ? DEFAULT_INTRO_OPTION_MESSAGES[defaultOption.id] : undefined);

      if (!messageTemplate) {
        throw new BadRequestException(`El mensaje de la opcion ${index + 1} es requerido.`);
      }

      if (messageTemplate.length > 1024) {
        throw new BadRequestException(`El mensaje de la opcion ${index + 1} no puede superar 1024 caracteres.`);
      }

      return {
        id,
        label,
        messageTemplate,
      };
    });
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

  private async collectProjectMediaFolders(flowUuid: string, idProyectoNetsuite: number, foldersToRemove: Set<string>) {
    const projectsRootRelativePath = join(flowUuid, "proyectos").replace(/\\/g, "/");
    const projectsRootPath = this.resolveStoragePath(projectsRootRelativePath);

    try {
      const entries = await fs.readdir(projectsRootPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith(`${idProyectoNetsuite}-`)) {
          foldersToRemove.add(join(projectsRootRelativePath, entry.name).replace(/\\/g, "/"));
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  private async mediaFileExists(media: Pick<FlowProjectMediaRecord, "relativePath">) {
    try {
      await fs.access(this.resolveStoragePath(media.relativePath));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Resuelve ruta absoluta bajo el storage root y bloquea path traversal (`../`).
   */
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
