import type { NavUser } from '@/lib/navigation';

/** Perfis sintéticos. As chaves são as da sessão efetiva (perfil ativo + individuais). */
export const PERFIS_REGRESSAO_322: Record<string, { permissoes: string[]; user?: NavUser }> = {
  'cco-322': {
    permissoes: [
      'matriz.cco._tela.visualizar',
      'dashboard.visualizar',
      'matriz.vistoria_campo._tela.visualizar',
      'fiscalizacoes.executar',
      'matriz.chamados._tela.visualizar',
      'chamados.gerenciar',
      'matriz.documentos._tela.visualizar',
      'documentos.visualizar',
      'matriz.execucao._tela.visualizar',
      'chamados.executar',
    ],
  },
  'sem-cco-322': {
    permissoes: ['matriz.chamados._tela.visualizar', 'chamados.gerenciar'],
  },
  'matriz-cco': {
    permissoes: ['matriz.cco._tela.visualizar'],
  },
  'legado-chamados': {
    permissoes: ['chamados.gerenciar'],
  },
  'so-vistoria': {
    permissoes: ['fiscalizacoes.executar'],
  },
  'so-abrir-chamado': {
    permissoes: ['chamados.abrir'],
  },
  'admin-permissoes': {
    permissoes: ['usuarios.gerenciar', 'permissoes.gerenciar'],
  },
  'administrador-sistema': {
    permissoes: [],
    user: { perfilAtivo: { nome: 'Administrador do Sistema' }, perfis: ['Administrador do Sistema'] },
  },
  vazio: {
    permissoes: [],
  },
  'dois-perfis-ativo-sem-cco': {
    permissoes: ['matriz.chamados._tela.visualizar', 'chamados.gerenciar'],
    user: {
      perfilAtivo: { nome: 'ZZTESTE 322 Perfil A' },
      perfis: ['ZZTESTE 322 Perfil A'],
    },
  },
};
