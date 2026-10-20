/** 298 — medição local (banco g296b, base completa 638.046 válidas). Uso: tsx medir-298.ts. Só leitura. */
import { gzipSync } from 'node:zlib';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { WebmapCamadasService } from '../../src/webmap-camadas/webmap-camadas.service';
import { requisicoesDaCamada, type Vista } from '../../frontend/lib/webmap-mapa';

(async () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  const s = new WebmapCamadasService(prisma as never, {} as never);
  const out: Record<string, unknown> = {};
  const t0 = performance.now();
  const lista = await s.arvore();
  out.lista = { ms: Math.round(performance.now() - t0), bytes: JSON.stringify(lista).length, gzipBytes: gzipSync(JSON.stringify(lista)).length, grupos: lista.length, camadas: lista.reduce((n, g) => n + g.camadas.length, 0) };
  out.totalValidas = await prisma.webmapElemento.count({ where: { geometriaInvalida: false } });
  // vistas 1280×800 e 390×844 (px) centradas no centro de Franca
  const vista = (lng: number, lat: number, z: number, w: number, h: number): Vista => {
    const degPx = 360 / (256 * 2 ** z);
    const dLng = (w / 2) * degPx, dLat = (h / 2) * degPx * Math.cos((lat * Math.PI) / 180);
    return { bounds: [lng - dLng, lat - dLat, lng + dLng, lat + dLat], zoom: z };
  };
  const vistas: Record<string, Vista> = {
    'bairro z16 1280x800': vista(-47.4008, -20.5386, 16, 1280, 800),
    'bairro z15 390x844': vista(-47.4008, -20.5386, 15, 390, 844),
    'cidade z13 1280x800': vista(-47.4008, -20.5386, 13, 1280, 800),
  };
  const camadas = lista.flatMap((g) => g.camadas).sort((a, b) => b.totalElementos - a.totalElementos).slice(0, 6);
  const linhas: unknown[] = [];
  for (const [nome, v] of Object.entries(vistas)) {
    for (const c of camadas) {
      const reqs = requisicoesDaCamada(c as never, v);
      let bytes = 0, gz = 0, feicoes = 0, maxMs = 0, maxBytes = 0, truncados = 0; const ini = performance.now();
      for (const r of reqs) {
        const a = performance.now();
        const gj = await s.geojson(c.camadaId, r.bbox?.join(','), r.zoom !== undefined ? String(r.zoom) : undefined, String(c.versaoAtual));
        const ms = performance.now() - a; const txt = JSON.stringify(gj); const b = txt.length; gz += gzipSync(txt).length;
        bytes += b; feicoes += gj.features.length; maxMs = Math.max(maxMs, ms); maxBytes = Math.max(maxBytes, b); if (gj.truncado) truncados++;
      }
      linhas.push({ vista: nome, camada: c.nomeOriginal, total: c.totalElementos, tiles: reqs.length, feicoes, kb: Math.round(bytes / 1024), kbGzip: Math.round(gz / 1024), maxKbTile: Math.round(maxBytes / 1024), msTotal: Math.round(performance.now() - ini), maxMsTile: Math.round(maxMs), truncados });
    }
  }
  out.porVista = linhas;
  console.log(JSON.stringify(out, null, 1));
  await prisma.$disconnect();
})();
