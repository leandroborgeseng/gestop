import { execSync } from 'node:child_process';
import { Client } from 'pg';
import { runDatabaseBootstrap } from './bootstrap';
import { logEnvSummary, logError, logInfo, logStep, logWarn, maskDatabaseUrl, ensureProductionRuntimeEnv } from './startup-log';

function runCommand(phase: string, command: string) {
  logStep(phase, `Executando: ${command}`);

  try {
    const output = execSync(command, {
      env: process.env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    if (output.trim()) {
      for (const line of output.trim().split('\n')) {
        logInfo(phase, line);
      }
    }

    logInfo(phase, 'Comando concluido com sucesso.');
  } catch (error) {
    const execError = error as {
      status?: number;
      stdout?: string;
      stderr?: string;
      message?: string;
    };

    if (execError.stdout?.trim()) {
      for (const line of execError.stdout.trim().split('\n')) {
        logInfo(phase, line);
      }
    }

    if (execError.stderr?.trim()) {
      for (const line of execError.stderr.trim().split('\n')) {
        logError(phase, line);
      }
    }

    logError(phase, `Comando falhou (${command})`, execError);
    throw error;
  }
}

async function inspectDatabase(phase: string) {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    logWarn(phase, 'DATABASE_URL ausente; inspecao do banco ignorada.');
    return;
  }

  const client = new Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 15_000,
  });

  await client.connect();

  try {
    const dbInfo = await client.query<{ db: string; user: string; version: string }>(`
      SELECT
        current_database() AS db,
        current_user AS "user",
        version() AS version
    `);

    const row = dbInfo.rows[0];
    logInfo(phase, `Conectado em ${row?.db ?? '?'} como ${row?.user ?? '?'}`);
    logInfo(phase, `PostgreSQL: ${row?.version?.split(',')[0] ?? 'desconhecido'}`);

    const tables = await client.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    logInfo(
      phase,
      tables.rows.length
        ? `Tabelas public (${tables.rows.length}): ${tables.rows.map((item) => item.table_name).join(', ')}`
        : 'Nenhuma tabela encontrada no schema public.',
    );

    const migrationsTable = tables.rows.some((item) => item.table_name === '_prisma_migrations');
    if (migrationsTable) {
      const migrations = await client.query<{
        migration_name: string;
        finished_at: Date | null;
        rolled_back_at: Date | null;
        logs: string | null;
      }>(`
        SELECT migration_name, finished_at, rolled_back_at, logs
        FROM "_prisma_migrations"
        ORDER BY started_at
      `);

      for (const migration of migrations.rows) {
        const status = migration.finished_at
          ? 'aplicada'
          : migration.rolled_back_at
            ? 'revertida'
            : 'falha/pendente';

        logInfo(phase, `Migration ${migration.migration_name}: ${status}`);
        if (migration.logs && status !== 'aplicada') {
          logWarn(phase, migration.logs.trim());
        }
      }
    }

    const hasUsuarioTable = tables.rows.some((item) => item.table_name === 'Usuario');
    if (hasUsuarioTable) {
      const users = await client.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM "Usuario"');
      logInfo(phase, `Usuarios cadastrados: ${users.rows[0]?.count ?? '0'}`);

      const sampleUsers = await client.query<{ email: string; nome: string }>(`
        SELECT email, nome
        FROM "Usuario"
        ORDER BY email
        LIMIT 5
      `);

      for (const user of sampleUsers.rows) {
        logInfo(phase, `Usuario seed: ${user.email} (${user.nome})`);
      }

      const secretarias = await client.query<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM "Secretaria"',
      );
      logInfo(phase, `Secretarias cadastradas: ${secretarias.rows[0]?.count ?? '0'}`);
    }
  } finally {
    await client.end();
  }
}

async function main() {
  ensureProductionRuntimeEnv();
  logStep('startup', 'Iniciando preparacao do banco de dados');
  logEnvSummary();

  await runDatabaseBootstrap();

  logStep('migrate', 'Aplicando migrations');
  runCommand('migrate', 'npx prisma migrate deploy');

  await inspectDatabase('pos-migrate');

  logStep('seed', 'Executando seed');
  runCommand('seed', 'node dist/prisma/seed.js');

  await inspectDatabase('pos-seed');

  logStep('reset-admin', 'Sincronizando senha do administrador');
  runCommand('reset-admin', 'node dist/prisma/reset-admin-password.js');

  logStep('startup', 'Preparacao do banco concluida. Subindo API NestJS.');
}

main().catch((error) => {
  logError('startup', 'Falha fatal durante a preparacao do banco', error);
  logError('startup', `DATABASE_URL em uso: ${maskDatabaseUrl(process.env.DATABASE_URL)}`);
  process.exit(1);
});
