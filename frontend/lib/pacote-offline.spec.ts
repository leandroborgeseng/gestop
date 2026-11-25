import { describe, expect, it } from 'vitest';
import { avisoPacoteVencido, estadoListaOffline, filtrarProgramacoesLocais, pacoteVencido, rotuloDadosLocais } from './pacote-offline';
import { classificarErroSync, rotuloErroSync } from './fila-sync';
import { ProgramacaoOffline } from './types';

const item = (id: string, data: string, over: Partial<ProgramacaoOffline> = {}): ProgramacaoOffline => ({
  id, cronogramaId: `c-${id}`, data, tipo: 'AGENDADA', frequencia: 'SEMANAL', checklist: { id: 'k', nome: 'Checklist Fictício 304' },
  unidade: { id: 'u1', nome: 'Próprio Fictício A', tipo: 'ESCOLA', endereco: 'Rua Fictícia', bairro: null, latitude: -20.5, longitude: -47.4, secretaria: { id: 's', nome: 'S', sigla: 'T306A' } },
  responsaveis: [{ id: 'g1', nome: 'Gestor Fictício A' }], checklistVersao: { id: 'v', versao: 1 }, ...over,
});

describe('304 O2/O9 — pacote offline', () => {
  it('O9: vence depois de validoAte (ou 7 dias do download em pacote antigo) e o aviso não bloqueia', () => {
    const pkg = { downloadedAt: '2026-10-16T10:00:00.000Z', validoAte: '2026-10-23T10:00:00.000Z', validadeDias: 7 };
    expect(pacoteVencido(pkg, new Date('2026-10-23T09:59:00.000Z'))).toBe(false);
    expect(pacoteVencido(pkg, new Date('2026-10-23T10:01:00.000Z'))).toBe(true);
    expect(pacoteVencido({ downloadedAt: '2026-10-01T00:00:00.000Z' }, new Date('2026-10-09T00:00:00.000Z'))).toBe(true);
    expect(avisoPacoteVencido(pkg)).toMatch(/passou de 7 dias.*continuar usando/);
  });
  it('O2: rótulo "Dados locais de dd/mm hh:mm"', () => {
    const d = new Date(2026, 9, 23, 8, 5);
    expect(rotuloDadosLocais(d.toISOString())).toBe('Dados locais de 23/10 08:05');
  });
  it('O2: filtros locais (período, tipo, próprio, atribuído a mim) e estados distintos', () => {
    const itens = [item('1', '2026-10-23'), item('2', '2026-10-30', { unidade: { ...item('x', '').unidade, id: 'u2', tipo: 'UBS' }, responsaveis: [] })];
    expect(filtrarProgramacoesLocais(itens, { from: '2026-10-24' }).map((i) => i.id)).toEqual(['2']);
    expect(filtrarProgramacoesLocais(itens, { tipo: 'ESCOLA' }).map((i) => i.id)).toEqual(['1']);
    expect(filtrarProgramacoesLocais(itens, { unidadeId: 'u2' }).map((i) => i.id)).toEqual(['2']);
    expect(filtrarProgramacoesLocais(itens, { atribuidoAMim: true, usuarioId: 'g1' }).map((i) => i.id)).toEqual(['1']);
    expect(estadoListaOffline(null, [])).toBe('SEM_DADOS_LOCAIS');
    expect(estadoListaOffline({ programacoes: undefined }, [])).toBe('SEM_DADOS_LOCAIS');
    expect(estadoListaOffline({ programacoes: itens }, [])).toBe('VAZIA');
  });
  it('O6/O10: erro do envio fica no item com o tipo certo', () => {
    const agora = new Date('2026-10-23T12:00:00Z');
    expect(classificarErroSync({ status: 409, codigo: 'PROGRAMACAO_JA_BAIXADA', message: 'Já baixada.' }, agora)).toMatchObject({ tipo: 'CONFLITO', codigo: 'PROGRAMACAO_JA_BAIXADA', tentativas: 1 });
    const esc = classificarErroSync({ status: 403, message: 'Fora.' }, agora, { tipo: 'REDE', mensagem: '', tentativas: 2, ultimaTentativaEm: '' });
    expect(esc).toMatchObject({ tipo: 'ESCOPO', tentativas: 3 });
    expect(classificarErroSync({ rede: true, message: 'x' }).tipo).toBe('REDE');
    expect(rotuloErroSync({ tipo: 'CONFLITO', mensagem: 'Já baixada.', tentativas: 1, ultimaTentativaEm: '' })).toContain('Nada foi sobrescrito');
  });
});
