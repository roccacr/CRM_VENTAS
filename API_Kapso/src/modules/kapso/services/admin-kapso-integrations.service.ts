// ============================================================================
// IMPORTS
// ============================================================================

import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";

import { ListAdminKapsoIntegrationsDto } from "../dto/list-admin-kapso-integrations.dto";
import { SaveAdminKapsoIntegrationDto } from "../dto/save-admin-kapso-integration.dto";
import { UpdateAdminKapsoIntegrationStatusDto } from "../dto/update-admin-kapso-integration-status.dto";
import { AdminKapsoIntegrationStatus } from "../entities/admin-kapso-integration.entity";
import { AdminKapsoIntegrationsRepository } from "../repositories/admin-kapso-integrations.repository";

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
  constructor(private readonly repository: AdminKapsoIntegrationsRepository) {}

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
}
