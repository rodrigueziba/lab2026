import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // <--- Esto hace que Prisma esté disponible en TODA la app
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}