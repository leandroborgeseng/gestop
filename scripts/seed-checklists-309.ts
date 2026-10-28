/**
 * 309 — seed fictício dos checklists inativos (inclui o seed 306).
 * Uso (banco LOCAL; antes: npx prisma generate && npx prisma migrate deploy):
 *   DATABASE_URL=postgresql://...localhost.../banco_teste SEED_306_SENHA='<senha de teste>' npm run seed:checklists-309
 * Recusa rodar fora de localhost ou com NODE_ENV=production (trava do 306).
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { assertBancoLocal306 } from './seed-escopo-306-core';
import { seedChecklists309, T309 } from './seed-checklists-309-core';

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  assertBancoLocal306(url);
  const senha = process.env.SEED_306_SENHA?.trim();
  if (!senha || senha.length < 12) throw new Error('Defina SEED_306_SENHA (>= 12 caracteres) para os usuários fictícios.');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const r = await seedChecklists309(prisma, senha, url);
    console.log(JSON.stringify({ ok: true, checklistAtivo: r.checklistAtivo, checklistInativo: r.checklistInativo, cronograma: r.cronograma, emails: { gestor: T309.gestor, todas: T309.todas, leitor: T309.leitor } }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
