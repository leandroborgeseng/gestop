// Seed SINTÉTICO responsáveis do cronograma (ZZTESTE). Só banco local _test.
import { PrismaPg } from '/workspace/gestop-resp/node_modules/@prisma/adapter-pg';
import { PrismaClient } from '/workspace/gestop-resp/node_modules/@prisma/client';
import { hashPassword } from '/workspace/gestop-resp/src/auth/password';
const url = process.env.DATABASE_URL!;
if (!/127\.0\.0\.1:55433\/gestop_resp_test/.test(url)) throw new Error('só banco local _test');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
async function main() {
const A = await prisma.secretaria.findUniqueOrThrow({ where: { sigla: 'ZZTA' } });
const B = await prisma.secretaria.findUniqueOrThrow({ where: { sigla: 'ZZTB' } });
const gest = await prisma.usuario.findUniqueOrThrow({ where: { email: 'zzteste.gestor.alfa@aion.local' } });
const mk = async (email: string, nome: string, secs: string[], ativo = true) => {
  const u = await prisma.usuario.upsert({ where: { email }, update: { ativo }, create: { email, nome, ativo, senhaHash: hashPassword('zzteste-senha-0123'), perfilAtivoId: gest.perfilAtivoId, secretariaId: secs[0], secretariaAtivaId: secs[0] } });
  await prisma.usuarioSecretaria.createMany({ data: secs.map((s, i) => ({ usuarioId: u.id, secretariaId: s, principal: i === 0 })), skipDuplicates: true });
  return u;
};
const ids: string[] = [];
for (let i = 1; i <= 9; i++) ids.push((await mk(`zzteste.resp.alfa${i}@aion.local`, `ZZTESTE Responsável Alfa ${i}`, [A.id])).id);
const multi = await mk('zzteste.resp.multi@aion.local', 'ZZTESTE Responsável Multi (A+B)', [A.id, B.id]);
const beta = await mk('zzteste.resp.beta@aion.local', 'ZZTESTE Responsável Beta', [B.id]);
const ina = await mk('zzteste.resp.inativo@aion.local', 'ZZTESTE Responsável Inativo', [A.id], false);
const un = await prisma.unidadePublica.findUniqueOrThrow({ where: { codigoPatrimonial: 'ZZT-A-002' } });
const ck = await prisma.checklist.findFirstOrThrow();
const c = await prisma.cronogramaChecagem.create({ data: { unidadeId: un.id, checklistId: ck.id, frequencia: 'MENSAL', proximaChecagemEm: new Date('2026-11-20T03:00:00Z'),
  responsaveis: { create: [ids[0], ina.id, beta.id].map((usuarioId) => ({ usuarioId })) } } });
console.log(JSON.stringify({ cronograma: c.id, multi: multi.id, beta: beta.id, inativo: ina.id }));
await prisma.$disconnect();
}
main();
