/**
 * 306 — seed fictício de duas Secretarias (T306A/T306B) para o Tester.
 * Uso (banco LOCAL já migrado):
 *   DATABASE_URL=postgresql://...localhost.../banco_teste SEED_306_SENHA='<senha de teste>' npm run seed:escopo-306
 * Recusa rodar se DATABASE_URL não apontar para localhost/127.0.0.1/socket local ou se NODE_ENV=production.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { seedEscopo306, T306 } from './seed-escopo-306-core';

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  const local = /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url) || /[?&]host=\//.test(url);
  if (!local || process.env.NODE_ENV === 'production') {
    throw new Error('seed:escopo-306 só roda em banco LOCAL de teste (DATABASE_URL em localhost) e fora de produção.');
  }
  const senha = process.env.SEED_306_SENHA?.trim();
  if (!senha || senha.length < 12) throw new Error('Defina SEED_306_SENHA (>= 12 caracteres) para os usuários fictícios.');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const r = await seedEscopo306(prisma, senha);
    console.log(JSON.stringify({ ok: true, ...r, emails: T306.emails, esperado: T306.esperado }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
