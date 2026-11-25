/**
 * 296-ALTO — processo filho com o SERVIÇO real aplicando com fonte lenta (heartbeat, bootId deste processo).
 * Uso: tsx aplicar-servico-worker.ts <dir-fonte> <atraso-ms-por-chunk>. Imprime "JOB <id>" e "BOOT <bootId>"; fica aplicando até ser morto.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { BOOT_ID } from '../../src/webmap-camadas/core';
import { DiretorioWebmapFonte } from '../../src/webmap-camadas/source';
import { WebmapCamadasService } from '../../src/webmap-camadas/webmap-camadas.service';

(async () => {
  process.env.WEBMAP_CAMADAS_WORKER = '0';
  const url = process.env.WEBMAP_CAMADAS_TEST_DATABASE_URL!;
  const atraso = Number(process.argv[3] ?? 1000);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  const fonte = new DiretorioWebmapFonte(process.argv[2]);
  const orig = fonte.lerStream.bind(fonte);
  let lenta = false; // só o aplicar é lento (a simulação lê na velocidade normal)
  fonte.lerStream = async function* (c: string) { for await (const x of orig(c)) { if (lenta) await new Promise((r) => setTimeout(r, atraso)); yield x; } };
  const service = new WebmapCamadasService(prisma as never, { persistBuffer: async () => ({ storageKey: 'k', url: '/u' }) } as never);
  service.usarFonte(fonte, url);
  const user = { sub: '', nome: 'Processo filho 296', email: 'f@aion.local', perfis: [], permissoes: [] };
  const sim = await service.simular(user as never);
  lenta = true;
  const r = await service.aplicar(user as never, sim.simulacaoId);
  console.log(`BOOT ${BOOT_ID}`);
  console.log(`JOB ${r.importacaoId}`);
  await service.execucao;
  console.log('FIM');
})();
