/** #311 — regras puras da aba Vistorias do drawer do CCO. */
type VistoriaCard = {
  id: string;
  concluidaEm: string | null;
  iniciadaEm: string | null;
  checklistVersao: { versao: number; checklist: { nome: string } };
};

function chave(v: Pick<VistoriaCard, 'concluidaEm' | 'iniciadaEm'>): number {
  const raw = v.concluidaEm ?? v.iniciadaEm;
  const t = raw ? Date.parse(raw) : NaN;
  return Number.isNaN(t) ? -Infinity : t;
}

/** Mais recente → mais antiga por `concluidaEm` (senão `iniciadaEm`); sem data vai para o fim. Estável. */
export function ordenarVistoriasRecentes<T extends Pick<VistoriaCard, 'concluidaEm' | 'iniciadaEm'>>(items: T[]): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => chave(b.item) - chave(a.item) || a.index - b.index)
    .map(({ item }) => item);
}

/** aria-label do card: `Abrir vistoria {checklist} v{versão}, {data}` (microcopy UX #311). */
export function rotuloCardVistoria(v: VistoriaCard): string {
  const raw = v.concluidaEm ?? v.iniciadaEm;
  const data = raw ? new Date(raw).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'sem data';
  return `Abrir vistoria ${v.checklistVersao.checklist.nome} v${v.checklistVersao.versao}, ${data}`;
}
