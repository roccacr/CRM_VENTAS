import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { createPrismaClient } from './prisma-client.factory';

/**
 * Cliente Prisma inyectable: conecta al init y desconecta al destroy.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly client = createPrismaClient();

  /** Modelo de integraciones WhatsApp Kapso. */
  readonly kapsoIntegracionNumeroWhatsapp = this.client.kapsoIntegracionNumeroWhatsapp;

  async onModuleInit(): Promise<void> {
    await this.client.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
