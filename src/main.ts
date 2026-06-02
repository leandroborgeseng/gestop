import * as Sentry from '@sentry/node';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { assertProductionEnv } from './config/env';

function initSentry() {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
  });
  console.log('[GestOP:api] Sentry inicializado');
}

async function bootstrap() {
  initSentry();

  console.log('[GestOP:api] Validando variaveis de producao...');
  try {
    assertProductionEnv();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    console.error('[GestOP:api] Corrija as variaveis no Railway → gestop → Variables → Redeploy.');
    process.exit(1);
  }

  console.log('[GestOP:api] Iniciando NestJS...');
  console.log(`[GestOP:api] NODE_ENV=${process.env.NODE_ENV ?? '(nao definido)'}`);

  const app = await NestFactory.create(AppModule, { rawBody: true });

  const corsOrigins = process.env.CORS_ORIGINS?.split(',').map((item) => item.trim()).filter(Boolean);
  app.enableCors({
    origin: corsOrigins?.length ? corsOrigins : true,
    credentials: true,
  });

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

void bootstrap().catch((error) => {
  Sentry.captureException(error);
  console.error('[GestOP:api] Falha ao iniciar', error);
  process.exit(1);
});
