import { describe, expect, it } from 'vitest';
import type { Prisma } from '@prisma/client';
import {
  agregarIndicadoresTarefas,
  linhasTotaisRelatorioFormal,
  somaGrupos,
  type DbAgregacaoTarefas,
} from './relatorio-tarefas-agregacao';

type Linha = {
  status: string;
  secretariaId: string;
  equipeId: string | null;
  responsavelId: string | null;
  chamadoId: string;
  prazo: Date | null;
};

const AGORA = new Date('2026-11-11T15:00:00.000Z');
const PASSADO = new Date('2020-01-01T00:00:00.000Z');
const FUTURO = new Date('2099-01-01T00:00:00.000Z');

/**
 * 604 tarefas no filtro, além do teto de 500.
 * EDU: 200 NOVA atrasadas, 50 NOVA no prazo, 80 concluídas (330).
 * SAU: 100 em andamento no prazo, 50 visualizadas atrasadas, 4 impedidas atrasadas,
 *      100 concluídas, 20 canceladas (274).
 * Pendentes = 250 + 150 = 400. Atrasadas = 200 + 54 = 254.
 */
function linhas604(): Linha[] {
  const linhas: Linha[] = [];
  const push = (qtd: number, linha: Omit<Linha, 'chamadoId'> & { chamadoId: string }) => {
    for (let i = 0; i < qtd; i += 1) linhas.push({ ...linha });
  };
  push(200, { status: 'NOVA', secretariaId: 'sec-edu', equipeId: 'eq-a', responsavelId: 'u-ana', chamadoId: 'ch-edu', prazo: PASSADO });
  push(50, { status: 'NOVA', secretariaId: 'sec-edu', equipeId: 'eq-a', responsavelId: 'u-ana', chamadoId: 'ch-edu', prazo: FUTURO });
  push(80, { status: 'CONCLUIDA', secretariaId: 'sec-edu', equipeId: 'eq-a', responsavelId: 'u-ana', chamadoId: 'ch-edu', prazo: PASSADO });
  push(100, { status: 'EM_ANDAMENTO', secretariaId: 'sec-sau', equipeId: null, responsavelId: null, chamadoId: 'ch-sau', prazo: FUTURO });
  push(50, { status: 'VISUALIZADA', secretariaId: 'sec-sau', equipeId: null, responsavelId: null, chamadoId: 'ch-sau', prazo: PASSADO });
  push(4, { status: 'IMPEDIDA', secretariaId: 'sec-sau', equipeId: null, responsavelId: null, chamadoId: 'ch-sau', prazo: PASSADO });
  push(100, { status: 'CONCLUIDA', secretariaId: 'sec-sau', equipeId: null, responsavelId: null, chamadoId: 'ch-sau', prazo: PASSADO });
  push(20, { status: 'CANCELADA', secretariaId: 'sec-sau', equipeId: null, responsavelId: null, chamadoId: 'ch-sau', prazo: PASSADO });
  return linhas;
}

function casa(linha: Linha, where: Prisma.ChamadoTarefaWhereInput | undefined): boolean {
  if (!where) return true;
  const filtro = where as {
    AND?: Prisma.ChamadoTarefaWhereInput[];
    OR?: Prisma.ChamadoTarefaWhereInput[];
    secretariaId?: { in?: string[] };
    status?: string | { in?: string[]; notIn?: string[] };
    prazo?: { lt?: Date };
    chamado?: unknown;
  };
  if (filtro.AND) return filtro.AND.every((parte) => casa(linha, parte));
  if (filtro.OR) return filtro.OR.some((parte) => casa(linha, parte));
  if (filtro.secretariaId?.in && !filtro.secretariaId.in.includes(linha.secretariaId)) return false;
  if (typeof filtro.status === 'string' && linha.status !== filtro.status) return false;
  if (filtro.status && typeof filtro.status === 'object') {
    if (filtro.status.in && !filtro.status.in.includes(linha.status)) return false;
    if (filtro.status.notIn && filtro.status.notIn.includes(linha.status)) return false;
  }
  if (filtro.prazo?.lt && (!linha.prazo || linha.prazo >= filtro.prazo.lt)) return false;
  return true;
}

function dbDas(linhas: Linha[]): DbAgregacaoTarefas {
  const groupBy: DbAgregacaoTarefas['chamadoTarefa']['groupBy'] = async (args) => {
    const grupos = new Map<string, Record<string, unknown> & { _count: { _all: number } }>();
    for (const linha of linhas.filter((item) => casa(item, args.where))) {
      const chave = args.by.map((campo) => String((linha as Record<string, unknown>)[campo] ?? '')).join('\0');
      const atual = grupos.get(chave) ?? { _count: { _all: 0 } };
      for (const campo of args.by) {
        const valor = (linha as Record<string, unknown>)[campo];
        atual[campo] = valor == null ? null : valor;
      }
      atual._count._all += 1;
      grupos.set(chave, atual);
    }
    return [...grupos.values()];
  };
  return {
    chamadoTarefa: {
      groupBy,
      count: async (args) => linhas.filter((item) => casa(item, args.where)).length,
    },
    secretaria: {
      findMany: async () => [
        { id: 'sec-edu', sigla: 'EDU', nome: 'Educação' },
        { id: 'sec-sau', sigla: 'SAU', nome: 'Saúde' },
      ],
    },
    equipe: { findMany: async () => [{ id: 'eq-a', nome: 'Equipe A' }] },
    usuario: { findMany: async () => [{ id: 'u-ana', nome: 'Ana ZZ' }] },
    chamado: {
      findMany: async () => [
        { id: 'ch-edu', tipoChamado: { nome: 'Vazamento' } },
        { id: 'ch-sau', tipoChamado: null },
      ],
    },
  };
}

describe('R-1 — agregação do relatório no filtro inteiro', () => {
  it('com 604 tarefas, pendentes por secretaria e os grupos fecham com o banco', async () => {
    const linhas = linhas604();
    expect(linhas).toHaveLength(604);
    const indicadores = await agregarIndicadoresTarefas(dbDas(linhas), { chamado: { excluidoEm: null } }, AGORA);

    expect(somaGrupos(indicadores.porSecretaria, 'total')).toBe(604);
    expect(somaGrupos(indicadores.porSecretaria, 'pendentes')).toBe(400);
    expect(somaGrupos(indicadores.porEquipe, 'total')).toBe(604);
    expect(somaGrupos(indicadores.porResponsavel, 'total')).toBe(604);
    expect(somaGrupos(indicadores.porTipoChamado, 'total')).toBe(604);
    expect(indicadores.abertas + indicadores.concluidas + 20).toBe(604);
    expect(indicadores).toMatchObject({
      abertas: 404,
      novas: 250,
      emAndamento: 150,
      impedidas: 4,
      concluidas: 180,
      atrasadas: 254,
    });
    expect(indicadores.porSecretaria).toEqual([
      { nome: 'EDU', total: 330, pendentes: 250, atrasadas: 200 },
      { nome: 'SAU', total: 274, pendentes: 150, atrasadas: 54 },
    ]);
    expect(indicadores.porEquipe).toEqual([
      { nome: 'Equipe A', total: 330, pendentes: 250, atrasadas: 200 },
      { nome: 'Sem equipe', total: 274, pendentes: 150, atrasadas: 54 },
    ]);
    expect(indicadores.porResponsavel).toEqual([
      { nome: 'Ana ZZ', total: 330, pendentes: 250, atrasadas: 200 },
      { nome: 'Sem responsável', total: 274, pendentes: 150, atrasadas: 54 },
    ]);
    expect(indicadores.porTipoChamado).toEqual([
      { nome: 'Vazamento', total: 330, pendentes: 250, atrasadas: 200 },
      { nome: 'Sem tipo', total: 274, pendentes: 150, atrasadas: 54 },
    ]);
    expect(linhasTotaisRelatorioFormal(indicadores)).toContain('Abertas: 404');
    expect(linhasTotaisRelatorioFormal(indicadores)).toContain('Pendentes por secretaria: EDU 250, SAU 150');
  });

  it('o where da listagem restringe a agregação (escopo de secretaria)', async () => {
    const indicadores = await agregarIndicadoresTarefas(
      dbDas(linhas604()),
      { secretariaId: { in: ['sec-edu'] } },
      AGORA,
    );
    expect(somaGrupos(indicadores.porSecretaria, 'total')).toBe(330);
    expect(somaGrupos(indicadores.porSecretaria, 'pendentes')).toBe(250);
    expect(indicadores.porSecretaria.map((grupo) => grupo.nome)).toEqual(['EDU']);
  });

  it('concluída com prazo vencido não entra em atrasadas', async () => {
    const indicadores = await agregarIndicadoresTarefas(dbDas(linhas604()), {}, AGORA);
    const concluidasComPrazoVelho = linhas604().filter((linha) => linha.status === 'CONCLUIDA' && linha.prazo && linha.prazo < AGORA).length;
    expect(concluidasComPrazoVelho).toBe(180);
    expect(indicadores.atrasadas).toBe(254);
  });
});
