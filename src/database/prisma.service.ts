import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { createPrismaClient } from './prisma-client.factory';

/**
 * Wrapper Nest del PrismaClient.
 *
 * Conecta en onModuleInit y desconecta en onModuleDestroy para un shutdown
 * limpio del pool. Expone solo los modelos que esta API usa hoy; si crece el
 * schema, se agregan propiedades explícitas (evita filtrar el client completo).
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly client = createPrismaClient();

  /** Tabla de integraciones de números WhatsApp Kapso. */
  readonly kapsoIntegracionNumeroWhatsapp = this.client.kapsoIntegracionNumeroWhatsapp;

  async onModuleInit(): Promise<void> {
    await this.client.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
