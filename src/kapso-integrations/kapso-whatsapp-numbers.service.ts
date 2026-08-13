import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { KapsoIntegracionNumeroWhatsapp } from '@prisma/client';

import { KapsoWhatsappNumberRepository } from './kapso-whatsapp-number.repository';

/** DTO CRM: fechas ISO e id como string. */
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

/** Respuesta corta de activate/deactivate. */
export type KapsoWhatsappNumberStatusDto = {
  readonly id: string;
  readonly isActive: boolean;
};

/** Caso de uso: listar y cambiar isActive de números WhatsApp Kapso. */
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

  /** Actualiza isActive; 404 si el id no existe o no es numérico. */
  private async setActive(id: string, isActive: boolean): Promise<KapsoWhatsappNumberStatusDto> {
    const parsedId = this.parseId(id);
    const updated = await this.repository.setActiveById(parsedId, isActive);

    if (updated === 0) {
      throw new NotFoundException('Kapso WhatsApp number integration not found');
    }

    return { id: parsedId.toString(), isActive };
  }

  /** Path param → bigint; ids no numéricos = 404. */
  private parseId(id: string): bigint {
    if (!/^\d+$/.test(id)) {
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
