import * as Sentry from '@sentry/node';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { assertProductionEnv } from './config/env';
import { inspectStorageHealth } from './storage/storage.health';

function initSentry() {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
  });
  console.log('[SIGMA:api] Sentry inicializado');
}

async function bootstrap() {
  initSentry();

  console.log('[SIGMA:api] Validando variaveis de producao...');
  try {
    assertProductionEnv();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    console.error('[SIGMA:api] Corrija as variaveis no Railway → gestop → Variables → Redeploy.');
    process.exit(1);
  }

  const storageHealth = await inspectStorageHealth();
  console.log(
    `[SIGMA:api] Storage ${storageHealth.status}: driver=${storageHealth.driver} dir=${'localDir' in storageHealth ? storageHealth.localDir : 'n/a'}${'storedFileCount' in storageHealth && storageHealth.storedFileCount != null ? ` files=${storageHealth.storedFileCount}` : ''}`,
  );
  if ('persistentHint' in storageHealth && storageHealth.persistentHint) {
    console.warn(`[SIGMA:api] ${storageHealth.persistentHint}`);
  }
  if ('errors' in storageHealth && storageHealth.errors?.length) {
    console.error(`[SIGMA:api] Storage indisponivel: ${storageHealth.errors.join('; ')}`);
    process.exit(1);
  }

  console.log('[SIGMA:api] Iniciando NestJS...');
  console.log(`[SIGMA:api] NODE_ENV=${process.env.NODE_ENV ?? '(nao definido)'}`);

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    rawBody: true,
  });

  // Fotos de celular em data URL (evidências de execução) podem passar de 10 MB.
  app.useBodyParser('json', { limit: '32mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '32mb' });

  const corsOrigins = process.env.CORS_ORIGINS?.split(',').map((item) => item.trim()).filter(Boolean);
  app.enableCors({
    origin: corsOrigins?.length ? corsOrigins : true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = Number(process.env.PORT ?? 3001);
  // Rede privada Railway usa IPv6 — escutar em :: evita "fetch failed" do frontend.
  await app.listen(port, '::');
  console.log(`[SIGMA:api] Servidor ouvindo em [::]:${port}`);
}

void bootstrap().catch((error) => {
  Sentry.captureException(error);
  console.error('[SIGMA:api] Falha ao iniciar', error);
  process.exit(1);
});
