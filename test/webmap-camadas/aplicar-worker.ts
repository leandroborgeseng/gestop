/** 296 — processo filho para o teste "matar no meio da importação". Uso: tsx aplicar-worker.ts <dir-fonte> */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { executarAplicacao, PgSessionLock, simular } from '../../src/webmap-camadas/core';
import { DiretorioWebmapFonte } from '../../src/webmap-camadas/source';

(async () => {
  const url = process.env.WEBMAP_CAMADAS_TEST_DATABASE_URL!;
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  const fonte = new DiretorioWebmapFonte(process.argv[2]);
  const { resultado } = await simular(prisma, fonte);
  const lock = new PgSessionLock(url);
  if (!(await lock.tentar())) throw new Error('sem lock');
  const job = await prisma.webmapImportacao.create({ data: { status: 'EM_ANDAMENTO', fase: 'lendo_fonte', usuarioNome: 'Worker 296', simulacaoId: resultado.simulacaoId, fonteHash: resultado.fonteHash } });
  console.log(`JOB ${job.id}`);
  await executarAplicacao(prisma, fonte, job.id, resultado, {
    aposLote: async ({ lote }) => {
      console.log(`LOTE ${lote}`);
      await new Promise((r) => setTimeout(r, 200));
    },
  });
  console.log('FIM');
})();
