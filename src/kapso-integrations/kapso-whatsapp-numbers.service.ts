import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { KapsoIntegracionNumeroWhatsapp } from '@prisma/client';

import { KapsoWhatsappNumberRepository } from './kapso-whatsapp-number.repository';

/** Solo dígitos: el PK es bigint; ids no numéricos se tratan como 404 (no 400). */
const NUMERIC_ID_PATTERN = /^\d+$/;

/**
 * DTO CRM: fechas en ISO-8601 e id como string (JSON no serializa bigint).
 * El shape es contrato de API: no agregar secretos ni payloads crudos de Kapso.
 */
export type KapsoWhatsappNumberDto = {
  readonly id: string;
  readonly kapsoPhoneNumberId: string;
  readonly kapsoProjectId: string | null;
  readonly kapsoCustomerId: string | null;
  readonly displayPhoneNumber: string | null;
  readonly phoneNumber: string | null;
  readonly businessAccountId: string | null;
  readonly businessName: string | null;
  readonly status: string;
  readonly isActive: boolean;
  readonly idnetsuiteAdminAsignado: number | null;
  readonly lastSyncAt: string | null;
  readonly connectedAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

/** Respuesta corta tras activate/deactivate. */
export type KapsoWhatsappNumberStatusDto = {
  readonly id: string;
  readonly isActive: boolean;
};

/**
 * Caso de uso: listar y cambiar isActive de números WhatsApp Kapso.
 * activate/deactivate son wrappers explícitos (API clara) sobre setActive.
 */
@Injectable()
export class KapsoWhatsappNumbersService {
  constructor(
    @Inject(KapsoWhatsappNumberRepository)
    private readonly repository: Pick<KapsoWhatsappNumberRepository, 'findAll' | 'setActiveById'>,
  ) {}

  async findAll(): Promise<KapsoWhatsappNumberDto[]> {
    const rows = await this.repository.findAll();
    return rows.map((row) => this.toDto(row));
  }

  activate(id: string): Promise<KapsoWhatsappNumberStatusDto> {
    return this.setActive(id, true);
  }

  deactivate(id: string): Promise<KapsoWhatsappNumberStatusDto> {
    return this.setActive(id, false);
  }

  /**
   * Actualiza isActive.
   * @throws {NotFoundException} si el id no es numérico o no existe en DB
   */
  private async setActive(id: string, isActive: boolean): Promise<KapsoWhatsappNumberStatusDto> {
    const parsedId = this.parseId(id);
    const updated = await this.repository.setActiveById(parsedId, isActive);

    if (updated === 0) {
      throw new NotFoundException('Kapso WhatsApp number integration not found');
    }

    return { id: parsedId.toString(), isActive };
  }

  /**
   * Path param → bigint.
   * Truthy-check no basta: "abc" es truthy pero no es un id usable.
   * Ids inválidos → 404 (mismo mensaje que "no existe") para no filtrar formato.
   */
  private parseId(id: string): bigint {
    if (!NUMERIC_ID_PATTERN.test(id)) {
      throw new NotFoundException('Kapso WhatsApp number integration not found');
    }

    return BigInt(id);
  }

  private toDto(row: KapsoIntegracionNumeroWhatsapp): KapsoWhatsappNumberDto {
    return {
      businessAccountId: row.businessAccountId,
      businessName: row.businessName,
      connectedAt: row.connectedAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      displayPhoneNumber: row.displayPhoneNumber,
      id: row.id.toString(),
      idnetsuiteAdminAsignado: row.idnetsuiteAdminAsignado,
      isActive: row.isActive,
      kapsoCustomerId: row.kapsoCustomerId,
      kapsoPhoneNumberId: row.kapsoPhoneNumberId,
      kapsoProjectId: row.kapsoProjectId,
      lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
      phoneNumber: row.phoneNumber,
      status: row.status,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
