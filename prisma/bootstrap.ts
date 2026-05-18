import { Client } from 'pg';

const databaseUrl = process.env.DATABASE_URL;

async function main() {
  if (!databaseUrl) {
    console.warn('DATABASE_URL nao configurada; bootstrap do banco ignorado.');
    return;
  }

  const client = new Client({
    connectionString: databaseUrl,
  });

  await client.connect();

  try {
    const hasMigrationsTable = await client.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = '_prisma_migrations'
      ) AS "exists"
    `);

    if (!hasMigrationsTable.rows[0]?.exists) {
      console.log('Tabela _prisma_migrations ainda nao existe; banco sera migrado normalmente.');
      return;
    }

    const failedMigrations = await client.query<{ migration_name: string }>(`
      SELECT migration_name
      FROM "_prisma_migrations"
      WHERE finished_at IS NULL
        AND rolled_back_at IS NULL
    `);

    const shouldReset =
      process.env.RESET_DATABASE_ON_START === 'true' || failedMigrations.rows.length > 0;

    if (!shouldReset) {
      console.log('Nenhuma migration falha detectada; reset do banco ignorado.');
      return;
    }

    console.warn(
      `Resetando schema public antes das migrations. Motivo: ${
        failedMigrations.rows.length > 0
          ? `migration falha (${failedMigrations.rows.map((row) => row.migration_name).join(', ')})`
          : 'RESET_DATABASE_ON_START=true'
      }`,
    );

    await client.query('DROP SCHEMA IF EXISTS public CASCADE');
    await client.query('CREATE SCHEMA public');
    await client.query('GRANT ALL ON SCHEMA public TO public');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Falha no bootstrap do banco.');
  console.error(error);
  process.exit(1);
});
