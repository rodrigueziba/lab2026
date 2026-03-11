import { Module } from '@nestjs/common';
import { ProyectoService } from './proyecto.service';
import { ProyectoController } from './proyecto.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificacionModule } from '../notificacion/notificacion.module';

@Module({
  imports: [PrismaModule, NotificacionModule],
  controllers: [ProyectoController],
  providers: [ProyectoService],
})
export class ProyectoModule {}