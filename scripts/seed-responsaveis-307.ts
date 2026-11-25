/**
 * 307 — seed fictício dos responsáveis do cronograma (inclui o seed 306).
 * Uso (banco LOCAL; antes: npx prisma generate && npx prisma migrate deploy):
 *   npx prisma generate && DATABASE_URL=postgresql://...localhost.../banco_teste SEED_306_SENHA='<senha de teste>' npm run seed:responsaveis-307
 * Recusa rodar fora de localhost ou com NODE_ENV=production (trava no core do 306).
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { assertBancoLocal306, T306 } from './seed-escopo-306-core';
import { seedResponsaveis307, T307 } from './seed-responsaveis-307-core';

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  assertBancoLocal306(url);
  const senha = process.env.SEED_306_SENHA?.trim();
  if (!senha || senha.length < 12) throw new Error('Defina SEED_306_SENHA (>= 12 caracteres) para os usuários fictícios.');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const r = await seedResponsaveis307(prisma, senha, url);
    console.log(JSON.stringify({ ok: true, cronogramaA: r.cronogramaA, cronogramaB: r.cronogramaB, emails: { ...T306.emails, inativo: T307.inativo, todas: T307.todas, extrasA: T307.extrasA } }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
