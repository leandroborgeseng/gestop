import { Client } from 'pg';
import { logError, logInfo, logStep, logWarn, maskDatabaseUrl } from './startup-log';

export async function runDatabaseBootstrap() {
  const databaseUrl = process.env.DATABASE_URL;

  logStep('bootstrap', 'Verificando estado do banco antes das migrations');

  if (!databaseUrl) {
    logWarn('bootstrap', 'DATABASE_URL nao configurada; bootstrap ignorado.');
    return;
  }

  logInfo('bootstrap', `DATABASE_URL=${maskDatabaseUrl(databaseUrl)}`);

  const client = new Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 15_000,
  });

  try {
    logStep('bootstrap', 'Tentando conectar ao PostgreSQL...');
    await client.connect();
    logInfo('bootstrap', 'Conexao estabelecida com sucesso.');

    const dbInfo = await client.query<{ db: string; user: string }>(`
      SELECT current_database() AS db, current_user AS "user"
    `);
    logInfo(
      'bootstrap',
      `Banco=${dbInfo.rows[0]?.db ?? '?'} usuario=${dbInfo.rows[0]?.user ?? '?'}`,
    );

    const hasMigrationsTable = await client.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = '_prisma_migrations'
      ) AS "exists"
    `);

    const migrationsTableExists = Boolean(hasMigrationsTable.rows[0]?.exists);
    logInfo(
      'bootstrap',
      migrationsTableExists
        ? 'Tabela _prisma_migrations encontrada.'
        : 'Tabela _prisma_migrations ainda nao existe; banco sera migrado normalmente.',
    );

    if (!migrationsTableExists) {
      return;
    }

    const failedMigrations = await client.query<{ migration_name: string; logs: string | null }>(`
      SELECT migration_name, logs
      FROM "_prisma_migrations"
      WHERE finished_at IS NULL
        AND rolled_back_at IS NULL
    `);

    if (failedMigrations.rows.length > 0) {
      logWarn(
        'bootstrap',
        `Migrations com falha detectadas: ${failedMigrations.rows.map((row) => row.migration_name).join(', ')}`,
      );

      for (const migration of failedMigrations.rows) {
        if (migration.logs) {
          logWarn('bootstrap', migration.logs.trim());
        }
      }
    } else {
      logInfo('bootstrap', 'Nenhuma migration com falha pendente.');
    }

    const hasUsuarioTable = await client.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'Usuario'
      ) AS "exists"
    `);

    const usuarioTableExists = Boolean(hasUsuarioTable.rows[0]?.exists);
    logInfo(
      'bootstrap',
      usuarioTableExists ? 'Tabela Usuario encontrada.' : 'Tabela Usuario ainda nao existe.',
    );

    const shouldReset =
      process.env.RESET_DATABASE_ON_START === 'true' ||
      process.env.FORCE_DB_RESET === 'true' ||
      failedMigrations.rows.length > 0;

    if (!shouldReset) {
      logInfo('bootstrap', 'Reset do schema public nao necessario.');
      return;
    }

    const resetReason =
      process.env.FORCE_DB_RESET === 'true'
        ? 'FORCE_DB_RESET=true'
        : process.env.RESET_DATABASE_ON_START === 'true'
          ? 'RESET_DATABASE_ON_START=true'
          : `migration falha (${failedMigrations.rows.map((row) => row.migration_name).join(', ')})`;

    logWarn('bootstrap', `Resetando schema public. Motivo: ${resetReason}`);

    await client.query('DROP SCHEMA IF EXISTS public CASCADE');
    logInfo('bootstrap', 'Schema public removido.');

    await client.query('CREATE SCHEMA public');
    logInfo('bootstrap', 'Schema public recriado.');

    await client.query('GRANT ALL ON SCHEMA public TO public');
    logInfo('bootstrap', 'Permissoes do schema public restauradas.');
  } catch (error) {
    logError('bootstrap', 'Falha ao preparar o banco de dados', error);
    throw error;
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  runDatabaseBootstrap().catch((error) => {
    logError('bootstrap', 'Encerrando por falha no bootstrap', error);
    process.exit(1);
  });
}
