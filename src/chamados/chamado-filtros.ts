/**
 * 295 · Filtro "Data de abertura" (Chamado.createdAt), compartilhado por
 * Chamados › Triagem (GET /chamados) e CCO › Todos os chamados (GET /operacional/chamados-mapa).
 * Módulo puro: só monta o trecho do where; escopo, permissões e exclusão lógica ficam onde estavam.
 */
import { Prisma } from '@prisma/client';
import { DATE_KEY_RE, inicioDoDiaNoFuso, proximoDateKey } from '../common/date.utils';

export const DIAS_ABERTURA_RAPIDOS = [10, 15, 30, 45, 60, 90, 180] as const;
export type DiasAberturaRapido = (typeof DIAS_ABERTURA_RAPIDOS)[number];

export const MSG_PERIODO_INVERTIDO = 'A data inicial não pode ser posterior à data final.';
const DIA_MS = 24 * 60 * 60 * 1000;

export type FiltroAberturaEntrada = { abertoDe?: string | null; abertoAte?: string | null; diasMinimos?: string | number | null };
export type FiltroAbertura = { abertoDe?: string; abertoAte?: string; diasMinimos?: DiasAberturaRapido };

/** Valida e normaliza. Erro de validação vem como mensagem (o service converte em 400). */
export function lerFiltroAbertura(entrada: FiltroAberturaEntrada | undefined): { filtro: FiltroAbertura } | { erro: string } {
  const de = entrada?.abertoDe?.trim() || undefined;
  const ate = entrada?.abertoAte?.trim() || undefined;
  const diasBruto = entrada?.diasMinimos;
  const diasTexto = diasBruto == null ? '' : String(diasBruto).trim();
  if (de && !validoDateKey(de)) return { erro: 'Data inicial inválida.' };
  if (ate && !validoDateKey(ate)) return { erro: 'Data final inválida.' };
  if (de && ate && de > ate) return { erro: MSG_PERIODO_INVERTIDO };
  let diasMinimos: DiasAberturaRapido | undefined;
  if (diasTexto) {
    const n = Number(diasTexto);
    if (!(DIAS_ABERTURA_RAPIDOS as readonly number[]).includes(n)) {
      return { erro: `Filtro rápido inválido. Use ${DIAS_ABERTURA_RAPIDOS.join(', ')} dias.` };
    }
    if (de || ate) return { erro: 'Use o filtro rápido ou o período por datas, não os dois.' };
    diasMinimos = n as DiasAberturaRapido;
  }
  return { filtro: { abertoDe: de, abertoAte: ate, diasMinimos } };
}

function validoDateKey(valor: string) {
  if (!DATE_KEY_RE.test(valor)) return false;
  const [a, m, d] = valor.split('-').map(Number);
  const data = new Date(Date.UTC(a, m - 1, d));
  return data.getUTCFullYear() === a && data.getUTCMonth() === m - 1 && data.getUTCDate() === d;
}

/**
 * Trecho do where para createdAt, ou null sem filtro.
 * - Datas: dia inicial e final inclusivos no fuso America/Sao_Paulo → [00:00 do inicial, 00:00 do dia seguinte ao final).
 * - Rápido N: createdAt < agora − N×24h (estrito: exatamente N dias não entra).
 */
export function whereAbertura(filtro: FiltroAbertura, agora: Date = new Date()): Prisma.ChamadoWhereInput | null {
  if (filtro.diasMinimos) {
    return { createdAt: { lt: new Date(agora.getTime() - filtro.diasMinimos * DIA_MS) } };
  }
  if (!filtro.abertoDe && !filtro.abertoAte) return null;
  const createdAt: Prisma.DateTimeFilter = {};
  if (filtro.abertoDe) createdAt.gte = inicioDoDiaNoFuso(filtro.abertoDe);
  if (filtro.abertoAte) createdAt.lt = inicioDoDiaNoFuso(proximoDateKey(filtro.abertoAte));
  return { createdAt };
}
