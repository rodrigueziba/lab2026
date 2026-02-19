import { Module } from '@nestjs/common';
import { PostulacionService } from './postulacion.service';
import { PostulacionController } from './postulacion.controller';
import { NotificacionModule } from 'src/notificacion/notificacion.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MailModule } from 'src/mail/mail.module';

@Module({
  imports: [PrismaModule, NotificacionModule, MailModule],
  controllers: [PostulacionController],
  providers: [PostulacionService],
})
export class PostulacionModule {}
