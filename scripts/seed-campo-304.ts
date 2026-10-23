/**
 * 303/304 — seed fictício de campo/offline (inclui os seeds 306 e 307).
 * Uso (banco LOCAL): DATABASE_URL=postgresql://...localhost.../banco_teste SEED_306_SENHA='<senha de teste>' npm run seed:campo-304
 * Recusa rodar fora de localhost ou com NODE_ENV=production (trava no core do 306).
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { assertBancoLocal306 } from './seed-escopo-306-core';
import { seedCampo304, T304 } from './seed-campo-304-core';

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  assertBancoLocal306(url);
  const senha = process.env.SEED_306_SENHA?.trim();
  if (!senha || senha.length < 12) throw new Error('Defina SEED_306_SENHA (>= 12 caracteres) para os usuários fictícios.');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const r = await seedCampo304(prisma, senha, url);
    console.log(JSON.stringify({ ok: true, cronograma304A: r.cronograma304A, cronograma304B: r.cronograma304B, checklist: T304.checklist }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
