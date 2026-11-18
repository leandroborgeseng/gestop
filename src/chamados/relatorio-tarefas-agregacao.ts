import { ChamadoTarefaStatus, Prisma } from '@prisma/client';
import { TAREFA_STATUS_PENDENTES } from './chamado-tarefa.regras';

/** Cartões e grupos do relatório. Saem do filtro inteiro, não do teto de linhas. */
export type IndicadoresRelatorioTarefas = {
  abertas: number;
  novas: number;
  emAndamento: number;
  impedidas: number;
  concluidas: number;
  atrasadas: number;
  porSecretaria: GrupoIndicadorTarefas[];
  porEquipe: GrupoIndicadorTarefas[];
  porResponsavel: GrupoIndicadorTarefas[];
  porTipoChamado: GrupoIndicadorTarefas[];
};

export type GrupoIndicadorTarefas = {
  nome: string;
  total: number;
  pendentes: number;
  atrasadas: number;
};

const PENDENTES = new Set<string>(TAREFA_STATUS_PENDENTES);

type LinhaGrupo = Record<string, unknown> & { _count: { _all: number } };

/**
 * O cliente só precisa de count/groupBy e da leitura dos nomes.
 * O where é o mesmo da listagem (escopo de secretaria e filtros).
 */
export type DbAgregacaoTarefas = {
  chamadoTarefa: {
    count(args: { where: Prisma.ChamadoTarefaWhereInput }): Promise<number>;
    groupBy(args: {
      by: string[];
      where: Prisma.ChamadoTarefaWhereInput;
      _count: { _all: true };
    }): Promise<LinhaGrupo[]>;
  };
  secretaria: {
    findMany(args: {
      where: { id: { in: string[] } };
      select: { id: true; sigla: true; nome: true };
    }): Promise<Array<{ id: string; sigla: string; nome: string }>>;
  };
  equipe: {
    findMany(args: {
      where: { id: { in: string[] } };
      select: { id: true; nome: true };
    }): Promise<Array<{ id: string; nome: string }>>;
  };
  usuario: {
    findMany(args: {
      where: { id: { in: string[] } };
      select: { id: true; nome: true };
    }): Promise<Array<{ id: string; nome: string }>>;
  };
  chamado: {
    findMany(args: {
      where: { id: { in: string[] } };
      select: { id: true; tipoChamado: { select: { nome: true } } };
    }): Promise<Array<{ id: string; tipoChamado: { nome: string } | null }>>;
  };
};

type Acumulo = { total: number; pendentes: number; atrasadas: number };

function soma(atual: Acumulo | undefined): Acumulo {
  return atual ?? { total: 0, pendentes: 0, atrasadas: 0 };
}

function aplicarStatus(linhas: LinhaGrupo[], chave: string, destino: Map<string, Acumulo>) {
  for (const linha of linhas) {
    const id = linha[chave] == null ? '' : String(linha[chave]);
    const status = String(linha.status ?? '');
    const n = linha._count._all;
    const atual = soma(destino.get(id));
    atual.total += n;
    if (PENDENTES.has(status)) atual.pendentes += n;
    destino.set(id, atual);
  }
}

function aplicarAtrasadas(linhas: LinhaGrupo[], chave: string, destino: Map<string, Acumulo>) {
  for (const linha of linhas) {
    const id = linha[chave] == null ? '' : String(linha[chave]);
    const atual = soma(destino.get(id));
    atual.atrasadas += linha._count._all;
    destino.set(id, atual);
  }
}

function ordenar(grupos: GrupoIndicadorTarefas[]) {
  return grupos.sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'));
}

function rotuloSecretaria(row?: { sigla: string; nome: string }) {
  return row?.sigla?.trim() || row?.nome?.trim() || '—';
}

/**
 * Cartões e agrupamentos com count/groupBy. Pendentes seguem TAREFA_STATUS_PENDENTES
 * (IMPEDIDA fica de fora). Atrasada é tarefa não final com prazo anterior a `agora`.
 */
export async function agregarIndicadoresTarefas(
  db: DbAgregacaoTarefas,
  where: Prisma.ChamadoTarefaWhereInput,
  agora = new Date(),
): Promise<IndicadoresRelatorioTarefas> {
  const whereAtrasada: Prisma.ChamadoTarefaWhereInput = {
    AND: [
      where,
      {
        status: { notIn: [ChamadoTarefaStatus.CONCLUIDA, ChamadoTarefaStatus.CANCELADA] },
        prazo: { lt: agora },
      },
    ],
  };
  const contar = { _count: { _all: true as const } };

  const [porStatus, atrasadas, secStatus, secAtraso, eqStatus, eqAtraso, respStatus, respAtraso, chStatus, chAtraso] =
    await Promise.all([
      db.chamadoTarefa.groupBy({ by: ['status'], where, ...contar }),
      db.chamadoTarefa.count({ where: whereAtrasada }),
      db.chamadoTarefa.groupBy({ by: ['secretariaId', 'status'], where, ...contar }),
      db.chamadoTarefa.groupBy({ by: ['secretariaId'], where: whereAtrasada, ...contar }),
      db.chamadoTarefa.groupBy({ by: ['equipeId', 'status'], where, ...contar }),
      db.chamadoTarefa.groupBy({ by: ['equipeId'], where: whereAtrasada, ...contar }),
      db.chamadoTarefa.groupBy({ by: ['responsavelId', 'status'], where, ...contar }),
      db.chamadoTarefa.groupBy({ by: ['responsavelId'], where: whereAtrasada, ...contar }),
      db.chamadoTarefa.groupBy({ by: ['chamadoId', 'status'], where, ...contar }),
      db.chamadoTarefa.groupBy({ by: ['chamadoId'], where: whereAtrasada, ...contar }),
    ]);

  const contagem = new Map<string, number>();
  for (const linha of porStatus) contagem.set(String(linha.status), linha._count._all);
  const n = (status: string) => contagem.get(status) ?? 0;
  const concluidas = n('CONCLUIDA');
  const canceladas = n('CANCELADA');
  const totalStatus = [...contagem.values()].reduce((acc, valor) => acc + valor, 0);

  const sec = new Map<string, Acumulo>();
  const eq = new Map<string, Acumulo>();
  const resp = new Map<string, Acumulo>();
  const ch = new Map<string, Acumulo>();
  aplicarStatus(secStatus, 'secretariaId', sec);
  aplicarAtrasadas(secAtraso, 'secretariaId', sec);
  aplicarStatus(eqStatus, 'equipeId', eq);
  aplicarAtrasadas(eqAtraso, 'equipeId', eq);
  aplicarStatus(respStatus, 'responsavelId', resp);
  aplicarAtrasadas(respAtraso, 'responsavelId', resp);
  aplicarStatus(chStatus, 'chamadoId', ch);
  aplicarAtrasadas(chAtraso, 'chamadoId', ch);

  const ids = (mapa: Map<string, Acumulo>) => [...mapa.keys()].filter(Boolean);
  const [secretarias, equipes, usuarios, chamados] = await Promise.all([
    ids(sec).length
      ? db.secretaria.findMany({ where: { id: { in: ids(sec) } }, select: { id: true, sigla: true, nome: true } })
      : [],
    ids(eq).length
      ? db.equipe.findMany({ where: { id: { in: ids(eq) } }, select: { id: true, nome: true } })
      : [],
    ids(resp).length
      ? db.usuario.findMany({ where: { id: { in: ids(resp) } }, select: { id: true, nome: true } })
      : [],
    ids(ch).length
      ? db.chamado.findMany({
          where: { id: { in: ids(ch) } },
          select: { id: true, tipoChamado: { select: { nome: true } } },
        })
      : [],
  ]);

  const nomeSec = new Map(secretarias.map((item) => [item.id, rotuloSecretaria(item)]));
  const nomeEq = new Map(equipes.map((item) => [item.id, item.nome?.trim() || 'Sem equipe']));
  const nomeResp = new Map(usuarios.map((item) => [item.id, item.nome?.trim() || 'Sem responsável']));
  const nomeTipo = new Map(chamados.map((item) => [item.id, item.tipoChamado?.nome?.trim() || 'Sem tipo']));

  return {
    abertas: totalStatus - concluidas - canceladas,
    novas: n('NOVA'),
    emAndamento: n('EM_ANDAMENTO') + n('VISUALIZADA'),
    impedidas: n('IMPEDIDA'),
    concluidas,
    atrasadas,
    porSecretaria: ordenar(juntar(sec, (id) => nomeSec.get(id) || '—')),
    porEquipe: ordenar(juntar(eq, (id) => (id ? nomeEq.get(id) || 'Sem equipe' : 'Sem equipe'))),
    porResponsavel: ordenar(juntar(resp, (id) => (id ? nomeResp.get(id) || 'Sem responsável' : 'Sem responsável'))),
    porTipoChamado: ordenar(juntar(ch, (id) => nomeTipo.get(id) || 'Sem tipo')),
  };
}

function juntar(mapa: Map<string, Acumulo>, rotulo: (id: string) => string) {
  const porNome = new Map<string, Acumulo>();
  for (const [id, counts] of mapa) {
    const nome = rotulo(id);
    const atual = soma(porNome.get(nome));
    atual.total += counts.total;
    atual.pendentes += counts.pendentes;
    atual.atrasadas += counts.atrasadas;
    porNome.set(nome, atual);
  }
  return [...porNome.entries()].map(([nome, counts]) => ({ nome, ...counts }));
}

/** Mesmos números dos cartões e de "Por secretaria", para o PDF formal. */
export function linhasTotaisRelatorioFormal(indicadores: IndicadoresRelatorioTarefas) {
  const pendentes = indicadores.porSecretaria.map((grupo) => `${grupo.nome} ${grupo.pendentes}`).join(', ');
  return [
    `Abertas: ${indicadores.abertas}`,
    `Novas: ${indicadores.novas}`,
    `Em andamento: ${indicadores.emAndamento}`,
    `Impedidas: ${indicadores.impedidas}`,
    `Concluídas: ${indicadores.concluidas}`,
    `Atrasadas: ${indicadores.atrasadas}`,
    `Pendentes por secretaria: ${pendentes || '—'}`,
  ];
}

export function somaGrupos(grupos: GrupoIndicadorTarefas[], campo: 'total' | 'pendentes' | 'atrasadas') {
  return grupos.reduce((acc, grupo) => acc + grupo[campo], 0);
}
