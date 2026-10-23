import { MobileFieldPackage, ProgramacaoOffline } from './types';

/** 304/O9 (D3): pacote vencido? Sem `validoAte` (pacote antigo), conta 7 dias do download. */
export function pacoteVencido(pkg: Pick<MobileFieldPackage, 'downloadedAt' | 'validoAte'>, agora = new Date()) {
  const limite = pkg.validoAte ? new Date(pkg.validoAte) : new Date(new Date(pkg.downloadedAt).getTime() + 7 * 86_400_000);
  return agora.getTime() > limite.getTime();
}

function doisDigitos(n: number) {
  return String(n).padStart(2, '0');
}

/** O2: "Dados locais de dd/mm hh:mm" (horário local do aparelho). */
export function rotuloDadosLocais(downloadedAt: string) {
  const d = new Date(downloadedAt);
  return `Dados locais de ${doisDigitos(d.getDate())}/${doisDigitos(d.getMonth() + 1)} ${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`;
}

export function avisoPacoteVencido(pkg: Pick<MobileFieldPackage, 'downloadedAt' | 'validadeDias'>) {
  const dias = pkg.validadeDias ?? 7;
  return `O pacote offline passou de ${dias} dias (${rotuloDadosLocais(pkg.downloadedAt).replace('Dados locais de ', 'baixado em ')}). Você pode continuar usando; baixe de novo quando tiver internet para atualizar as programações.`;
}

export type FiltrosProgramadas = { from?: string; to?: string; atribuidoAMim?: boolean; tipo?: string; unidadeId?: string; usuarioId?: string };

/** O2: os mesmos filtros da lista online, aplicados ao pacote local. */
export function filtrarProgramacoesLocais(itens: ProgramacaoOffline[], f: FiltrosProgramadas) {
  return itens
    .filter((i) => (!f.from || i.data >= f.from) && (!f.to || i.data <= f.to))
    .filter((i) => !f.tipo || i.unidade.tipo === f.tipo)
    .filter((i) => !f.unidadeId || i.unidade.id === f.unidadeId)
    .filter((i) => !f.atribuidoAMim || (f.usuarioId ? i.responsaveis.some((r) => r.id === f.usuarioId) : false))
    .sort((a, b) => a.data.localeCompare(b.data) || a.unidade.nome.localeCompare(b.unidade.nome));
}

/** O2: estado da lista offline — "sem conexão" (nada local) é diferente de "lista vazia" (filtros sem resultado). */
export function estadoListaOffline(pkg: Pick<MobileFieldPackage, 'programacoes'> | null, filtrados: unknown[]) {
  if (!pkg || !pkg.programacoes) return 'SEM_DADOS_LOCAIS' as const;
  return filtrados.length ? ('COM_ITENS' as const) : ('VAZIA' as const);
}
