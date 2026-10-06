import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildPopupHtml } from './chamado-map-popup';
import {
  resumoDoChamado,
  tarefaExecucaoToMapPoint,
  type ChamadoTarefaResumo,
} from './chamado-tarefa';
import type { ChamadoMapPoint } from './types';

const panelSrc = readFileSync(join(__dirname, '../components/chamados/execucao-tarefas-panel.tsx'), 'utf8');
const mapSrc = readFileSync(join(__dirname, '../components/chamados/chamados-execucao-map-client.tsx'), 'utf8');

function resumoBase(overrides: Partial<ChamadoTarefaResumo> = {}): ChamadoTarefaResumo {
  return {
    id: 'tarefa-1',
    titulo: 'Vistoria no local',
    descricao: null,
    prazo: '2026-10-10T00:00:00.000Z',
    prioridade: 'ALTA',
    status: 'NOVA',
    justificativa: null,
    conclusaoTexto: null,
    observacao: null,
    atrasada: false,
    createdAt: '2026-10-01T12:00:00.000Z',
    concluidaEm: null,
    visualizadaEm: null,
    secretaria: { id: 's1', nome: 'Educação', sigla: 'EDU' },
    equipe: { id: 'e1', nome: 'Equipe Norte' },
    responsavel: { id: 'u1', nome: 'Ana Souza' },
    criadaPor: { id: 'u0', nome: 'Admin' },
    concluidaPor: null,
    anexos: [],
    podeTratar: true,
    chamado: {
      id: 'ch1',
      codigo: 'CH-001',
      titulo: 'Vazamento na cobertura',
      descricao: 'Água escorrendo pela laje do ginásio',
      status: 'ABERTO',
      prioridade: 'ALTA',
      enderecoTexto: 'Rua das Flores, 10',
      prazoEm: null,
      latitude: -20.53,
      longitude: -47.4,
      tipoChamado: { id: 't1', nome: 'Vazamento' },
      unidade: { id: 'un1', nome: 'EMEF Centro', endereco: 'Rua A' },
      secretaria: { id: 's1', nome: 'Educação', sigla: 'EDU' },
      equipe: { id: 'e1', nome: 'Equipe Norte' },
    },
    ...overrides,
  };
}

describe('251 — coluna Resumo do chamado', () => {
  it('usa o título do chamado e trunca a descrição com reticências', () => {
    expect(resumoDoChamado({ titulo: 'Vazamento na cobertura', descricao: 'texto longo' })).toBe(
      'Vazamento na cobertura',
    );
    const descricao = 'Água escorrendo pela laje do ginásio municipal durante a chuva forte da madrugada';
    const resumo = resumoDoChamado({ titulo: null, descricao });
    expect(resumo.endsWith('…')).toBe(true);
    expect(resumo.replace(/…$/, '').length).toBeLessThanOrEqual(60);
    expect(resumo).toContain('Água escorrendo');
    expect(resumo).not.toContain('madrugada');
    expect(resumoDoChamado({ titulo: '   ', descricao: '   ' })).toBe('—');
  });

  it('a grade da aba Tarefas tem a coluna Resumo do chamado preenchida pelo helper', () => {
    expect(panelSrc).toContain('<th className="p-2">Resumo do chamado</th>');
    expect(panelSrc).toContain('resumoDoChamado(item.chamado)');
    expect(panelSrc.indexOf('Resumo do chamado')).toBeLessThan(panelSrc.indexOf('<th className="p-2">Tarefa</th>'));
  });
});

describe('251 — responsável no pop-up do pin', () => {
  it('o ponto do mapa leva o responsável da tarefa', () => {
    const ponto = tarefaExecucaoToMapPoint(resumoBase());
    expect(ponto?.unidadeNome).toBe('Tarefa · EMEF Centro');
    expect(ponto?.titulo).toBe('Vistoria no local');
    expect(ponto?.codigo).toBe('CH-001');
    expect(ponto?.equipeNome).toBe('Equipe Norte');
    expect(ponto?.prazoEm).toBe('2026-10-10T00:00:00.000Z');
    expect(ponto?.responsavelNome).toBe('Ana Souza');
  });

  it('o pop-up mostra responsável e mantém Tarefa ·, título, número, prazo, equipe e o botão', () => {
    const ponto: ChamadoMapPoint = {
      id: 'tarefa-1',
      codigo: 'CH-001',
      titulo: 'Vistoria no local',
      latitude: -20.53,
      longitude: -47.4,
      unidadeNome: 'Tarefa · EMEF Centro',
      prioridade: 'Alta',
      equipeNome: 'Equipe Norte',
      prazoEm: '2026-10-10T00:00:00.000Z',
      responsavelNome: 'Ana Souza',
    };
    const html = buildPopupHtml(ponto, 'Executar tarefa');
    expect(html).toContain('CH-001');
    expect(html).toContain('Vistoria no local');
    expect(html).toContain('Tarefa · EMEF Centro');
    expect(html).toContain('Equipe:');
    expect(html).toContain('Equipe Norte');
    expect(html).toContain('Responsável:');
    expect(html).toContain('Ana Souza');
    expect(html).toContain('Prazo:');
    expect(html).toContain('Executar tarefa');
    expect(panelSrc).toContain('popupActionLabel="Executar tarefa"');
    expect(panelSrc).toContain('tarefaExecucaoToMapPoint');
    expect(mapSrc).toContain("from '@/lib/chamado-map-popup'");
  });
});
