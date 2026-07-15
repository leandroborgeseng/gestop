import { PrismaService } from '../prisma/prisma.service';

export type ExecucaoParticipanteExport = {
  id?: string;
  nome: string;
  cargo?: string | null;
  origem: 'equipe' | 'externo';
  secretariaSigla?: string | null;
};

export type ExecucaoParticipantesResumo = {
  equipeExecutoraNome: string | null;
  participantes: ExecucaoParticipanteExport[];
};

function parseParticipante(value: unknown, origemDefault: 'equipe' | 'externo'): ExecucaoParticipanteExport | null {
  if (typeof value === 'string' && value.trim()) {
    return { nome: value.trim(), cargo: null, origem: origemDefault };
  }
  if (!value || typeof value !== 'object') return null;
  const item = value as {
    id?: unknown;
    nome?: unknown;
    cargo?: unknown;
    origem?: unknown;
    secretaria?: { sigla?: unknown } | null;
  };
  if (typeof item.nome !== 'string' || !item.nome.trim()) return null;
  const origem =
    item.origem === 'externo' || item.origem === 'equipe'
      ? item.origem
      : origemDefault;
  return {
    id: typeof item.id === 'string' ? item.id : undefined,
    nome: item.nome.trim(),
    cargo: typeof item.cargo === 'string' && item.cargo.trim() ? item.cargo.trim() : null,
    origem,
    secretariaSigla:
      typeof item.secretaria?.sigla === 'string' && item.secretaria.sigla.trim()
        ? item.secretaria.sigla.trim()
        : null,
  };
}

function parseParticipantesFromMetadata(metadata: unknown): ExecucaoParticipantesResumo | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const data = metadata as {
    tipo?: string;
    equipeExecutora?: { nome?: string; codigo?: string | null } | null;
    membrosExecutores?: unknown;
    membrosExternos?: unknown;
    participantes?: unknown;
  };

  if (data.tipo !== 'execucao_conclusao' && data.tipo !== 'execucao_manual') {
    return null;
  }

  const participantes: ExecucaoParticipanteExport[] = [];

  if (Array.isArray(data.participantes) && data.participantes.length > 0) {
    for (const item of data.participantes) {
      const parsed = parseParticipante(item, 'equipe');
      if (parsed) participantes.push(parsed);
    }
  } else {
    if (Array.isArray(data.membrosExecutores)) {
      for (const item of data.membrosExecutores) {
        const parsed = parseParticipante(item, 'equipe');
        if (parsed) participantes.push(parsed);
      }
    }
    if (Array.isArray(data.membrosExternos)) {
      for (const item of data.membrosExternos) {
        const parsed = parseParticipante(item, 'externo');
        if (parsed) participantes.push(parsed);
      }
    }
  }

  const equipeNome = data.equipeExecutora?.nome
    ? data.equipeExecutora.codigo
      ? `${data.equipeExecutora.codigo} · ${data.equipeExecutora.nome}`
      : data.equipeExecutora.nome
    : null;

  return { equipeExecutoraNome: equipeNome, participantes };
}

/** Usa o evento de conclusão mais recente (não a equipe atual do chamado). */
export async function loadExecucaoParticipantes(
  prisma: PrismaService,
  chamadoIds: string[],
): Promise<Map<string, ExecucaoParticipantesResumo>> {
  const result = new Map<string, ExecucaoParticipantesResumo>();
  if (chamadoIds.length === 0) return result;

  const registros = await prisma.historicoStatus.findMany({
    where: {
      entidadeTipo: 'Chamado',
      entidadeId: { in: chamadoIds },
      OR: [
        { metadata: { path: ['tipo'], equals: 'execucao_conclusao' } },
        { metadata: { path: ['tipo'], equals: 'execucao_manual' } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    select: { entidadeId: true, metadata: true },
  });

  for (const registro of registros) {
    if (result.has(registro.entidadeId)) continue;
    const parsed = parseParticipantesFromMetadata(registro.metadata);
    if (parsed) result.set(registro.entidadeId, parsed);
  }

  return result;
}

export function formatParticipantesExport(resumo: ExecucaoParticipantesResumo | null | undefined) {
  if (!resumo?.participantes.length) {
    return {
      equipe: resumo?.equipeExecutoraNome ?? '',
      nomes: '',
      cargos: '',
      ids: '',
      detalhe: '',
    };
  }

  return {
    equipe: resumo.equipeExecutoraNome ?? '',
    nomes: resumo.participantes.map((item) => item.nome).join('; '),
    cargos: resumo.participantes.map((item) => item.cargo ?? (item.origem === 'externo' ? 'membro externo' : '')).join('; '),
    ids: resumo.participantes.map((item) => item.id ?? '').join('; '),
    detalhe: resumo.participantes
      .map((item) => {
        const cargo =
          item.cargo ?? (item.origem === 'externo' ? 'membro externo' : null);
        return cargo ? `${item.nome} — ${cargo}` : item.nome;
      })
      .join('; '),
  };
}
