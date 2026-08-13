import { Inject, Injectable } from '@nestjs/common';
import { KapsoIntegracionNumeroWhatsapp, Prisma } from '@prisma/client';

import { runDatabaseCheck } from '../database/database-check';
import { PrismaService } from '../database/prisma.service';

/** Status inicial al upsert desde evento whatsapp.phone_number.created. */
const STATUS_CREATED = 'created';

/**
 * Superficie mínima de Prisma para este repo.
 * Tipar el client completo acoplaría los tests a todo el schema; este pick
 * permite mocks literales en unit tests.
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

/** Input del evento Kapso whatsapp.phone_number.created. */
export type KapsoWhatsappNumberCreatedInput = {
  readonly kapsoPhoneNumberId: string;
  readonly kapsoProjectId?: string | undefined;
  readonly kapsoCustomerId?: string | undefined;
  readonly rawPayload: Prisma.InputJsonValue;
};

/**
 * Persistencia de KapsoIntegracionNumeroWhatsapp.
 * Usado por la API CRM y por el procesamiento de webhooks.
 */
@Injectable()
export class KapsoWhatsappNumberRepository {
  constructor(@Inject(PrismaService) private readonly prisma: KapsoWhatsappNumberReader) {}

  private get table() {
    return this.prisma.kapsoIntegracionNumeroWhatsapp;
  }

  count(): Promise<number> {
    return this.table.count();
  }

  /**
   * True si count() no lanza.
   * Reusa runDatabaseCheck para no duplicar el try/catch del probe.
   */
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

  /** Listado por createdAt desc; `where` opcional (exactOptionalPropertyTypes). */
  private list(
    where?: Prisma.KapsoIntegracionNumeroWhatsappWhereInput,
  ): Promise<KapsoIntegracionNumeroWhatsapp[]> {
    return this.table.findMany({
      orderBy: { createdAt: 'desc' },
      ...(where ? { where } : {}),
    });
  }

  /**
   * Upsert por kapsoPhoneNumberId.
   * create: fija connectedAt; update: refresca metadatos/payload sin tocar connectedAt.
   */
  async upsertFromKapsoCreatedEvent(input: KapsoWhatsappNumberCreatedInput): Promise<void> {
    const shared = {
      isActive: true,
      kapsoCustomerId: input.kapsoCustomerId ?? null,
      kapsoProjectId: input.kapsoProjectId ?? null,
      status: STATUS_CREATED,
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

  /** @returns filas eliminadas (0 = no existía). */
  async deleteByKapsoPhoneNumberId(kapsoPhoneNumberId: string): Promise<number> {
    const result = await this.table.deleteMany({ where: { kapsoPhoneNumberId } });
    return result.count;
  }

  /** @returns filas afectadas (0 = id inexistente). */
  async setActiveById(id: bigint, isActive: boolean): Promise<number> {
    const result = await this.table.updateMany({ data: { isActive }, where: { id } });
    return result.count;
  }
}
