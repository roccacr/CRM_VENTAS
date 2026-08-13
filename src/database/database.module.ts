import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';

/** Acceso global a MySQL vía Prisma. */
@Global()
@Module({
  exports: [PrismaService],
  providers: [PrismaService],
})
export class DatabaseModule {}
