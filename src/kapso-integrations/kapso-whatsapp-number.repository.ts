import { Inject, Injectable } from '@nestjs/common';
import { KapsoIntegracionNumeroWhatsapp, Prisma } from '@prisma/client';

import { runDatabaseCheck } from '../database/database-check';
import { PrismaService } from '../database/prisma.service';

/**
 * Superficie mínima de Prisma (facilita mocks en tests).
 */
type KapsoWhatsappNumberReader = {
  readonly kapsoIntegracionNumeroWhatsapp: {
    readonly count: () => Promise<number>;
    readonly deleteMany: (
      args: Prisma.KapsoIntegracionNumeroWhatsappDeleteManyArgs,
    ) => Promise<Prisma.BatchPayload>;
    readonly findMany: (
      args: Prisma.KapsoIntegracionNumeroWhatsappFindManyArgs,
    ) => Promise<KapsoIntegracionNumeroWhatsapp[]>;
    readonly updateMany: (
      args: Prisma.KapsoIntegracionNumeroWhatsappUpdateManyArgs,
    ) => Promise<Prisma.BatchPayload>;
    readonly upsert: (
      args: Prisma.KapsoIntegracionNumeroWhatsappUpsertArgs,
    ) => Promise<KapsoIntegracionNumeroWhatsapp>;
  };
};

/** Datos del evento Kapso whatsapp.phone_number.created. */
export type KapsoWhatsappNumberCreatedInput = {
  readonly kapsoPhoneNumberId: string;
  readonly kapsoProjectId?: string | undefined;
  readonly kapsoCustomerId?: string | undefined;
  readonly rawPayload: Prisma.InputJsonValue;
};

/** Persistencia de KapsoIntegracionNumeroWhatsapp (API CRM + webhooks). */
@Injectable()
export class KapsoWhatsappNumberRepository {
  constructor(@Inject(PrismaService) private readonly prisma: KapsoWhatsappNumberReader) {}

  private get table() {
    return this.prisma.kapsoIntegracionNumeroWhatsapp;
  }

  count(): Promise<number> {
    return this.table.count();
  }

  /** True si un count() no lanza (reusa runDatabaseCheck). */
  async canReadTable(): Promise<boolean> {
    const result = await runDatabaseCheck(this);
    return result.canReadTable;
  }

  findActive(): Promise<KapsoIntegracionNumeroWhatsapp[]> {
    return this.list({ isActive: true });
  }

  findAll(): Promise<KapsoIntegracionNumeroWhatsapp[]> {
    return this.list();
  }

  /** Listado ordenado por createdAt desc, con filtro opcional. */
  private list(
    where?: Prisma.KapsoIntegracionNumeroWhatsappWhereInput,
  ): Promise<KapsoIntegracionNumeroWhatsapp[]> {
    return this.table.findMany({
      orderBy: { createdAt: 'desc' },
      ...(where ? { where } : {}),
    });
  }

  /** Upsert por kapsoPhoneNumberId al evento created. */
  async upsertFromKapsoCreatedEvent(input: KapsoWhatsappNumberCreatedInput): Promise<void> {
    const shared = {
      isActive: true,
      kapsoCustomerId: input.kapsoCustomerId ?? null,
      kapsoProjectId: input.kapsoProjectId ?? null,
      status: 'created',
      ultimoPayloadKapso: input.rawPayload,
    };

    await this.table.upsert({
      create: {
        ...shared,
        connectedAt: new Date(),
        kapsoPhoneNumberId: input.kapsoPhoneNumberId,
      },
      update: shared,
      where: { kapsoPhoneNumberId: input.kapsoPhoneNumberId },
    });
  }

  async deleteByKapsoPhoneNumberId(kapsoPhoneNumberId: string): Promise<number> {
    const result = await this.table.deleteMany({ where: { kapsoPhoneNumberId } });
    return result.count;
  }

  async setActiveById(id: bigint, isActive: boolean): Promise<number> {
    const result = await this.table.updateMany({ data: { isActive }, where: { id } });
    return result.count;
  }
}
