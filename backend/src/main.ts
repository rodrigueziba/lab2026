import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configuración del Totem (Swagger)
  const config = new DocumentBuilder()
    .setTitle('Film Commission TDF')
    .setDescription('Documentación de la API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document); // La web estará en /api
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  // Habilitar que el Frontend (en otro puerto) pueda hablar con el Backend
  app.enableCors();

  await app.listen(3000);
}
bootstrap();
