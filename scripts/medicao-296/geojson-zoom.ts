/* 296 — tempos do GeoJSON das camadas pesadas por zoom (bbox da tela 1280x800 no centro de Franca + camada inteira no zoom 12). */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { WebmapCamadasService } from '../../src/webmap-camadas/webmap-camadas.service';

(async () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.MEDIR_DB! }) });
  const s = new WebmapCamadasService(prisma as never, {} as never);
  const pesadas = await prisma.webmapCamada.findMany({ where: { versaoAtual: { not: null } }, orderBy: { totalElementos: 'desc' }, take: 6, select: { id: true, nomeOriginal: true, totalElementos: true, bytesOrigem: true, bbox: true } });
  const [cx, cy] = [-47.4009, -20.5386];
  console.log('camada | elementos | arquivo | zoom | bbox | features | truncado | ms | KB');
  for (const c of pesadas) {
    const casos: Array<[number, number[] | null]> = [];
    for (const z of [12, 14, 16, 18]) {
      const w = (1280 * 360) / (256 * 2 ** z), h = (800 * 360) / (256 * 2 ** z);
      casos.push([z, [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2]]);
    }
    casos.push([12, c.bbox as number[]]);
    for (const [z, b] of casos) {
      const t0 = process.hrtime.bigint();
      const gj = await s.geojson(c.id, b!.join(','), String(z));
      const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      const kb = Buffer.byteLength(JSON.stringify(gj)) / 1024;
      console.log([c.nomeOriginal, c.totalElementos, (c.bytesOrigem / 1e6).toFixed(1) + ' MB', z, b === c.bbox ? 'camada inteira' : 'tela', gj.features.length, gj.truncado, ms.toFixed(0), kb.toFixed(0)].join(' | '));
    }
  }
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
