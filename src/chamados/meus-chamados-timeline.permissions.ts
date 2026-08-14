import { permissionMatrixKey } from '../domain/permissions-catalog';

export const MEUS_CHAMADOS_TIMELINE_KEYS = {
  fotosAbertura: permissionMatrixKey('meus_chamados', 'fotos_abertura', 'visualizar'),
  evidenciasExecucao: permissionMatrixKey('meus_chamados', 'evidencias_execucao', 'visualizar'),
  participantesExecucao: permissionMatrixKey('meus_chamados', 'participantes_execucao', 'visualizar'),
  equipeExecutora: permissionMatrixKey('meus_chamados', 'equipe_executora', 'visualizar'),
  evidenciasRegistradas: permissionMatrixKey('meus_chamados', 'evidencias_registradas', 'visualizar'),
  relatorioExecucao: permissionMatrixKey('meus_chamados', 'relatorio_execucao', 'visualizar'),
  mudancaStatus: permissionMatrixKey('meus_chamados', 'mudanca_status', 'visualizar'),
  mudancaAtribuicao: permissionMatrixKey('meus_chamados', 'mudanca_atribuicao', 'visualizar'),
  atualizacaoProgramacao: permissionMatrixKey('meus_chamados', 'atualizacao_programacao', 'visualizar'),
  atualizacaoAtribuicao: permissionMatrixKey('meus_chamados', 'atualizacao_atribuicao', 'visualizar'),
  historicosAvulsos: permissionMatrixKey('meus_chamados', 'historicos_avulsos', 'visualizar'),
  cadastrarObservadores: permissionMatrixKey('meus_chamados', 'cadastrar_observadores', 'inserir'),
  consultarDocumentos: permissionMatrixKey('meus_chamados', 'consultar_documentos', 'visualizar'),
} as const;

const GRANULAR_KEYS = Object.values(MEUS_CHAMADOS_TIMELINE_KEYS);

export type MeusChamadosTimelineCaps = {
  fotosAbertura: boolean;
  evidenciasExecucao: boolean;
  participantesExecucao: boolean;
  equipeExecutora: boolean;
  evidenciasRegistradas: boolean;
  relatorioExecucao: boolean;
  mudancaStatus: boolean;
  mudancaAtribuicao: boolean;
  atualizacaoProgramacao: boolean;
  atualizacaoAtribuicao: boolean;
  historicosAvulsos: boolean;
  cadastrarObservadores: boolean;
  consultarDocumentos: boolean;
};

function hasMeusChamadosAccess(permissoes: string[]) {
  return (
    permissoes.includes('meus_chamados.visualizar') ||
    permissoes.includes('chamados.abrir') ||
    permissoes.includes('chamados.gerenciar') ||
    permissoes.includes('usuarios.gerenciar') ||
    permissoes.some((key) => key.startsWith('matriz.meus_chamados.') && key.endsWith('.visualizar'))
  );
}

export function resolveMeusChamadosTimelineCaps(permissoes: string[]): MeusChamadosTimelineCaps {
  const admin = permissoes.includes('usuarios.gerenciar');
  const hasAnyGranular = GRANULAR_KEYS.some((key) => permissoes.includes(key));
  const legacyAll = !hasAnyGranular && hasMeusChamadosAccess(permissoes);

  const allow = (key: string) => admin || legacyAll || permissoes.includes(key);

  return {
    fotosAbertura: allow(MEUS_CHAMADOS_TIMELINE_KEYS.fotosAbertura),
    evidenciasExecucao: allow(MEUS_CHAMADOS_TIMELINE_KEYS.evidenciasExecucao),
    participantesExecucao: allow(MEUS_CHAMADOS_TIMELINE_KEYS.participantesExecucao),
    equipeExecutora: allow(MEUS_CHAMADOS_TIMELINE_KEYS.equipeExecutora),
    evidenciasRegistradas: allow(MEUS_CHAMADOS_TIMELINE_KEYS.evidenciasRegistradas),
    relatorioExecucao: allow(MEUS_CHAMADOS_TIMELINE_KEYS.relatorioExecucao),
    mudancaStatus: allow(MEUS_CHAMADOS_TIMELINE_KEYS.mudancaStatus),
    mudancaAtribuicao: allow(MEUS_CHAMADOS_TIMELINE_KEYS.mudancaAtribuicao),
    atualizacaoProgramacao: allow(MEUS_CHAMADOS_TIMELINE_KEYS.atualizacaoProgramacao),
    atualizacaoAtribuicao: allow(MEUS_CHAMADOS_TIMELINE_KEYS.atualizacaoAtribuicao),
    historicosAvulsos: allow(MEUS_CHAMADOS_TIMELINE_KEYS.historicosAvulsos),
    cadastrarObservadores: allow(MEUS_CHAMADOS_TIMELINE_KEYS.cadastrarObservadores),
    consultarDocumentos: allow(MEUS_CHAMADOS_TIMELINE_KEYS.consultarDocumentos),
  };
}
