import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrestadorModule } from './prestador/prestador.module';
import { PrismaService } from './prisma/prisma.service';
import { LocacionModule } from './locacion/locacion.module';
import { AuthModule } from './auth/auth.module';
import { ProyectoModule } from './proyecto/proyecto.module';
import { PrismaModule } from './prisma/prisma.module';
import { PostulacionModule } from './postulacion/postulacion.module';
import { SolicitudModule } from './solicitud/solicitud.module';
import { NotificacionModule } from './notificacion/notificacion.module';
import { MailModule } from './mail/mail.module';
import { UserModule } from './user/user.module';
import { ConfigModule } from '@nestjs/config';
import { SolicitudController } from './solicitud/solicitud.controller';
import { SolicitudService } from './solicitud/solicitud.service';
import { NotificacionController } from './notificacion/notificacion.controller';
import { NotificacionService } from './notificacion/notificacion.service';

@Module({
  imports: [
    PrestadorModule,
    LocacionModule,
    AuthModule,
    ProyectoModule,
    PrismaModule,
    PostulacionModule,
    SolicitudModule,
    NotificacionModule,
    MailModule,
    UserModule,
    ConfigModule.forRoot({ isGlobal: true }),
  ],
  controllers: [AppController, SolicitudController, NotificacionController],
  providers: [PrismaService, AppService, SolicitudService, NotificacionService],
})
export class AppModule {}
