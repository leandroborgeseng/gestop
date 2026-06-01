import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { assertProductionEnv } from './config/env';

async function bootstrap() {
  assertProductionEnv();

  console.log('[GestOP:api] Iniciando NestJS...');
  console.log(`[GestOP:api] NODE_ENV=${process.env.NODE_ENV ?? '(nao definido)'}`);

  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  console.log(`[GestOP:api] Servidor ouvindo na porta ${port}`);
}

void bootstrap();
