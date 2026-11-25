/**
 * 295 · Filtro "Data de abertura" (front). Mesmo valor nas duas telas (Triagem e CCO).
 * Para o servidor vai o período (YYYY-MM-DD, dias inclusivos em America/Sao_Paulo) ou o número de dias
 * do filtro rápido (`diasMinimos`) — nunca a data de referência mostrada ao usuário.
 */
export const DIAS_ABERTURA_RAPIDOS = [10, 15, 30, 45, 60, 90, 180] as const;
export type DiasAberturaRapido = (typeof DIAS_ABERTURA_RAPIDOS)[number];
export type FiltroDataAberturaValue = { de?: string; ate?: string; rapido?: DiasAberturaRapido };

export const MSG_PERIODO_INVERTIDO = 'A data inicial não pode ser posterior à data final.';
export const FUSO_ABERTURA = 'America/Sao_Paulo';
const DIA_MS = 24 * 60 * 60 * 1000;

export function periodoInvertido(v: Pick<FiltroDataAberturaValue, 'de' | 'ate'>): boolean {
  return Boolean(v.de && v.ate && v.de > v.ate);
}

export function filtroAberturaAtivo(v: FiltroDataAberturaValue | undefined): boolean {
  return Boolean(v?.rapido || v?.de || v?.ate);
}

/** Parâmetros de consulta. Rápido tem precedência e manda só o número de dias. */
export function aberturaParaQuery(v: FiltroDataAberturaValue | undefined): { abertoDe?: string; abertoAte?: string; diasMinimos?: string } {
  if (!v) return {};
  if (v.rapido) return { diasMinimos: String(v.rapido) };
  if (periodoInvertido(v)) return {};
  return { ...(v.de ? { abertoDe: v.de } : {}), ...(v.ate ? { abertoAte: v.ate } : {}) };
}

/** YYYY-MM-DD → dd/mm/aaaa (sem passar por Date, sem fuso). */
export function formatarDiaBr(dateKey: string): string {
  const [a, m, d] = dateKey.split('-');
  return `${d}/${m}/${a}`;
}

/** Resumo da sanfona recolhida; null sem filtro de data. */
export function resumoDataAbertura(v: FiltroDataAberturaValue | undefined): string | null {
  if (!v) return null;
  if (v.rapido) return `Abertos há mais de ${v.rapido} dias`;
  if (periodoInvertido(v)) return null;
  if (v.de && v.ate) return `Abertos entre ${formatarDiaBr(v.de)} e ${formatarDiaBr(v.ate)}`;
  if (v.de) return `Abertos a partir de ${formatarDiaBr(v.de)}`;
  if (v.ate) return `Abertos até ${formatarDiaBr(v.ate)}`;
  return null;
}

function partesSp(instante: Date) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_ABERTURA,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(instante);
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return { dia: `${v('year')}-${v('month')}-${v('day')}`, hora: `${v('hour')}:${v('minute')}` };
}

/** Referência visual do rápido: Data final = dia (SP) de agora − N×24h, e o texto de ajuda com a hora. */
export function referenciaRapido(n: DiasAberturaRapido, agora: Date = new Date()): { ate: string; ajuda: string } {
  const { dia, hora } = partesSp(new Date(agora.getTime() - n * DIA_MS));
  return { ate: dia, ajuda: `Abertos antes de ${formatarDiaBr(dia)} às ${hora} (mais de ${n} dias completos).` };
}
