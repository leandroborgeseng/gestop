/**
 * 306 — seed fictício de duas Secretarias (T306A/T306B) para o Tester.
 * Uso (banco LOCAL; antes: npx prisma generate && npx prisma migrate deploy):
 *   npx prisma generate && DATABASE_URL=postgresql://...localhost.../banco_teste SEED_306_SENHA='<senha de teste>' npm run seed:escopo-306
 * Recusa rodar se DATABASE_URL não apontar para localhost/127.0.0.1/socket local ou se NODE_ENV=production.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { assertBancoLocal306, seedEscopo306, T306 } from './seed-escopo-306-core';

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  assertBancoLocal306(url);
  const senha = process.env.SEED_306_SENHA?.trim();
  if (!senha || senha.length < 12) throw new Error('Defina SEED_306_SENHA (>= 12 caracteres) para os usuários fictícios.');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const r = await seedEscopo306(prisma, senha, url);
    console.log(JSON.stringify({ ok: true, ...r, emails: T306.emails, esperado: T306.esperado }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
