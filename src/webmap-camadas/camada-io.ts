/**
 * 296 — leitura/gravação de UMA camada em fluxo, sem Prisma (só SQL parametrizado).
 * Roda no worker do job (heap limitado) ou no próprio processo (testes). Nada da camada inteira fica em memória:
 * cada elemento é lido, reparado e vai para um lote de até LOTE_ELEMENTOS / LOTE_BYTES, gravado e solto.
 */
import { randomUUID } from 'node:crypto';
import { ElementoLido, ErroLeitura, lerElementosStream } from './parse';
import type { WebmapCamadasFonte } from './source';

export const LOTE_ELEMENTOS = 500;
export const LOTE_BYTES = 1024 * 1024;

export type Contagem = { pontos: number; linhas: number; poligonos: number };
export type Stats = Contagem & { corrigidos: number; invalidos: number; erros: ErroLeitura[]; bbox: number[]; hash?: string };

export function novoStats(): Stats {
  return { pontos: 0, linhas: 0, poligonos: 0, corrigidos: 0, invalidos: 0, erros: [], bbox: [Infinity, Infinity, -Infinity, -Infinity] };
}
export function somar(s: Stats, e: ElementoLido) {
  if (e.familia === 'POINT') s.pontos++;
  else if (e.familia === 'LINE') s.linhas++;
  else s.poligonos++;
  if (e.corrigida) s.corrigidos++;
  s.bbox = [Math.min(s.bbox[0], e.bbox[0]), Math.min(s.bbox[1], e.bbox[1]), Math.max(s.bbox[2], e.bbox[2]), Math.max(s.bbox[3], e.bbox[3])];
}

export type AlvoCamada = { arquivo: string; label: string; grupo?: string };
export type AlvoGravacao = AlvoCamada & { camadaId: string; versaoId: string };
/** Executor SQL mínimo (pg Client no worker, prisma.$executeRawUnsafe no processo). */
export type ExecSql = (sql: string, params: unknown[]) => Promise<unknown>;

/** Simulação: só conta (e guarda os erros, que são poucos). Nenhum elemento é retido. */
export async function contarCamada(fonte: WebmapCamadasFonte, a: AlvoCamada): Promise<Stats> {
  const s = novoStats();
  await lerElementosStream(fonte.lerStream(`layers/${a.arquivo}`), a.label, a.grupo, (e) => somar(s, e), (e) => { s.invalidos++; s.erros.push(e); });
  return s;
}

const INSERT = `INSERT INTO "WebmapElemento" ("id","camadaId","versao","fidOrigem","geometriaTipo","geometria","geometriaOriginal","corrigida","atributos","minLng","minLat","maxLng","maxLat")
SELECT x.id, x."camadaId", x.versao, x."fidOrigem", x."geometriaTipo", x.geometria, x."geometriaOriginal", x.corrigida, x.atributos, x."minLng", x."minLat", x."maxLng", x."maxLat"
FROM jsonb_to_recordset($1::jsonb) AS x(id text, "camadaId" text, versao text, "fidOrigem" text, "geometriaTipo" text, geometria jsonb, "geometriaOriginal" jsonb, corrigida boolean, atributos jsonb, "minLng" float8, "minLat" float8, "maxLng" float8, "maxLat" float8)`;

/**
 * Grava a camada na versão `versaoId` (apaga antes o que essa versão já tinha: retentativa nunca duplica).
 * O lote vira um único texto JSON (um parâmetro) e é solto logo após o INSERT.
 */
export async function gravarCamada(
  exec: ExecSql, fonte: WebmapCamadasFonte, a: AlvoGravacao,
  ganchos: { aposLote?: (lote: number) => Promise<void> | void } = {},
): Promise<Stats> {
  await exec(`DELETE FROM "WebmapElemento" WHERE "versao" = $1`, [a.versaoId]);
  const s = novoStats();
  let partes: string[] = [];
  let bytes = 0;
  let nLote = 0;
  const flush = async () => {
    if (!partes.length) return;
    const json = `[${partes.join(',')}]`;
    partes = [];
    bytes = 0;
    await exec(INSERT, [json]);
    nLote++;
    await ganchos.aposLote?.(nLote);
  };
  await lerElementosStream(fonte.lerStream(`layers/${a.arquivo}`), a.label, a.grupo, async (e) => {
    somar(s, e);
    const linha = JSON.stringify({
      id: randomUUID(), camadaId: a.camadaId, versao: a.versaoId, fidOrigem: e.fidOrigem, geometriaTipo: e.geometriaTipo,
      geometria: e.geometria, geometriaOriginal: e.geometriaOriginal ?? null, corrigida: e.corrigida, atributos: e.atributos,
      minLng: e.bbox[0], minLat: e.bbox[1], maxLng: e.bbox[2], maxLat: e.bbox[3],
    });
    partes.push(linha);
    bytes += linha.length;
    if (partes.length >= LOTE_ELEMENTOS || bytes >= LOTE_BYTES) await flush();
  }, (e) => { s.invalidos++; s.erros.push(e); });
  await flush();
  return s;
}
