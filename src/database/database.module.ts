import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';

/**
 * Acceso global a MySQL vía Prisma.
 * @Global evita reimportar DatabaseModule en cada feature module.
 */
@Global()
@Module({
  exports: [PrismaService],
  providers: [PrismaService],
})
export class DatabaseModule {}
