/**
 * 305 — seed fictício da exclusão lógica de vistorias.
 * Uso (banco LOCAL com `_test` no nome; antes: npx prisma generate && npx prisma migrate deploy):
 *   DATABASE_URL=postgresql://...localhost.../gestop_test SEED_305_SENHA='<senha de teste>' npm run seed:exclusao-305
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { assertBancoTeste305, seedExclusao305, T305 } from './seed-exclusao-305-core';

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  assertBancoTeste305(url);
  const senha = process.env.SEED_305_SENHA?.trim();
  if (!senha || senha.length < 12) throw new Error('Defina SEED_305_SENHA (>= 12 caracteres) para os usuários fictícios.');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const r = await seedExclusao305(prisma, senha, url);
    console.log(JSON.stringify({ ok: true, cronograma: r.cronograma, emails: { gestor: T305.gestor, excluidor: T305.excluidor, leitor: T305.leitor, gestorB: T305.gestorB } }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
