export type ChamadoPinPrioridade = 'baixa' | 'media' | 'alta';

const PIN_COLORS: Record<ChamadoPinPrioridade, string> = {
  baixa: '#1f845a',
  media: '#b38600',
  alta: '#c9372c',
};

export function chamadoPinPrioridade(prioridade: string): ChamadoPinPrioridade {
  if (prioridade.includes('URG') || prioridade.includes('ALTA')) return 'alta';
  if (prioridade.includes('MED')) return 'media';
  return 'baixa';
}

export function chamadoPinColor(prioridade: string) {
  return PIN_COLORS[chamadoPinPrioridade(prioridade)];
}

export function chamadoEstaProgramado(chamado: { previstaExecucaoEm?: string | null }) {
  return Boolean(chamado.previstaExecucaoEm);
}

export function chamadoPinIcon(programado: boolean) {
  return programado ? '✓' : '⏱';
}
