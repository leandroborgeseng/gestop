/**
 * 296 — leitura/gravação de UMA camada em fluxo, sem Prisma (só SQL parametrizado).
 * Roda no worker do job (heap limitado) ou no próprio processo (testes). Nada da camada inteira fica em memória:
 * cada elemento é lido, reparado e vai para um lote de até LOTE_ELEMENTOS / LOTE_BYTES, gravado e solto.
 */
import { createHash } from 'node:crypto';
import { ElementoLido, ErroLeitura, lerElementosStream } from './parse';
import type { WebmapCamadasFonte } from './source';

/** Pacote (b): lote menor para baixar o pico do aplicar (antes 500 / 1 MiB). Contagens não dependem do lote. */
export const LOTE_ELEMENTOS = 200;
export const LOTE_BYTES = 256 * 1024;

/**
 * Id estável da feição nesta versão da camada: ordem na fonte (a mesma leitura reproduz o mesmo id).
 * Reaplicar faz upsert nesta chave — não gera outra linha e não apaga o que o lote anterior já gravou.
 */
export function idFeicaoEstavel(camadaId: string, versaoId: string, indice: number) {
  const h = createHash('sha1').update(`${camadaId}\0${versaoId}\0${indice}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

export type Contagem = { pontos: number; linhas: number; poligonos: number };
export type Stats = Contagem & { corrigidos: number; invalidos: number; erros: ErroLeitura[]; bbox: number[]; hash?: string };

export function novoStats(): Stats {
  return { pontos: 0, linhas: 0, poligonos: 0, corrigidos: 0, invalidos: 0, erros: [], bbox: [Infinity, Infinity, -Infinity, -Infinity] };
}
export function somar(s: Stats, e: ElementoLido) {
  if (e.geometriaInvalida || !e.bbox) return; // contada em `invalidos` (via erro)
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

const UPSERT = `INSERT INTO "WebmapElemento" ("id","camadaId","versao","fidOrigem","geometriaTipo","geometria","geometriaOriginal","corrigida","atributos","minLng","minLat","maxLng","maxLat","geometriaInvalida")
SELECT x.id, x."camadaId", x.versao, x."fidOrigem", x."geometriaTipo", coalesce(x.geometria, 'null'::jsonb), x."geometriaOriginal", x.corrigida, x.atributos, x."minLng", x."minLat", x."maxLng", x."maxLat", coalesce(x."geometriaInvalida", false)
FROM jsonb_to_recordset($1::jsonb) AS x(id text, "camadaId" text, versao text, "fidOrigem" text, "geometriaTipo" text, geometria jsonb, "geometriaOriginal" jsonb, corrigida boolean, atributos jsonb, "minLng" float8, "minLat" float8, "maxLng" float8, "maxLat" float8, "geometriaInvalida" boolean)
ON CONFLICT ("id") DO UPDATE SET
  "camadaId" = EXCLUDED."camadaId",
  versao = EXCLUDED.versao,
  "fidOrigem" = EXCLUDED."fidOrigem",
  "geometriaTipo" = EXCLUDED."geometriaTipo",
  geometria = EXCLUDED.geometria,
  "geometriaOriginal" = EXCLUDED."geometriaOriginal",
  corrigida = EXCLUDED.corrigida,
  atributos = EXCLUDED.atributos,
  "minLng" = EXCLUDED."minLng",
  "minLat" = EXCLUDED."minLat",
  "maxLng" = EXCLUDED."maxLng",
  "maxLat" = EXCLUDED."maxLat",
  "geometriaInvalida" = EXCLUDED."geometriaInvalida"`;

/**
 * Grava a camada na versão `versaoId` em lotes. Cada lote é um upsert pela chave estável da feição
 * e é solto logo após o INSERT: uma aplicação interrompida no meio pode ser reaplicada sem duplicar
 * e sem apagar as feições que os lotes anteriores já gravaram.
 */
export async function gravarCamada(
  exec: ExecSql, fonte: WebmapCamadasFonte, a: AlvoGravacao,
  ganchos: { aposLote?: (lote: number) => Promise<void> | void } = {},
): Promise<Stats> {
  const s = novoStats();
  let partes: string[] = [];
  let bytes = 0;
  let nLote = 0;
  let indice = 0;
  const flush = async () => {
    if (!partes.length) return;
    // o texto do lote só existe durante o INSERT; as partes são soltas antes de esperar o banco
    let json: string | null = `[${partes.join(',')}]`;
    partes = [];
    bytes = 0;
    const params: unknown[] = [json];
    json = null;
    await exec(UPSERT, params);
    params.length = 0;
    nLote++;
    await ganchos.aposLote?.(nLote);
  };
  await lerElementosStream(fonte.lerStream(`layers/${a.arquivo}`), a.label, a.grupo, async (e) => {
    somar(s, e);
    const linha = JSON.stringify({
      id: idFeicaoEstavel(a.camadaId, a.versaoId, indice++), camadaId: a.camadaId, versao: a.versaoId, fidOrigem: e.fidOrigem, geometriaTipo: e.geometriaTipo,
      geometria: e.geometria, geometriaOriginal: e.geometriaOriginal ?? null, corrigida: e.corrigida, atributos: e.atributos,
      geometriaInvalida: e.geometriaInvalida,
      minLng: e.bbox?.[0] ?? null, minLat: e.bbox?.[1] ?? null, maxLng: e.bbox?.[2] ?? null, maxLat: e.bbox?.[3] ?? null,
    });
    partes.push(linha);
    bytes += linha.length;
    if (partes.length >= LOTE_ELEMENTOS || bytes >= LOTE_BYTES) await flush();
  }, (e) => { s.invalidos++; s.erros.push(e); });
  await flush();
  return s;
}
