import { describe, expect, it } from 'vitest';
import { marcarComoAvulsaPorConflito } from './fila-sync';
import { MobileQueuedInspection } from './types';

const item = {
  clientEventId: 'e1',
  deviceId: 'device-ficticio',
  unidadeId: 'u1',
  checklistVersaoId: 'v1',
  iniciadaEm: '2026-10-23T10:00:00.000Z',
  concluidaEm: '2026-10-23T10:10:00.000Z',
  checkin: { latitude: -20.5, longitude: -47.4, precisaoMetros: 10 },
  respostas: [],
  cronogramaId: 'c1',
  dataProgramada: '2026-10-16',
  programacaoAtualizadaEm: '2026-10-20T00:00:00.000Z',
  sync: { tipo: 'CONFLITO', codigo: 'PROGRAMACAO_ALTERADA', mensagem: 'x', tentativas: 1, ultimaTentativaEm: '2026-10-23T10:11:00.000Z' },
} as unknown as MobileQueuedInspection;

describe('304/O6a marcarComoAvulsaPorConflito', () => {
  it('motivo obrigatório (mín. 5)', () => {
    expect(marcarComoAvulsaPorConflito(item, '   ')).toEqual({ erro: expect.stringMatching(/motivo/) });
    expect(marcarComoAvulsaPorConflito(item, 'abc')).toHaveProperty('erro');
  });
  it('tira o vínculo de baixa, guarda a referência, o código e o motivo; limpa o erro local', () => {
    const r = marcarComoAvulsaPorConflito(item, '  Programação mudou  ');
    if (!('item' in r)) throw new Error('esperava item');
    expect(r.item.cronogramaId).toBeUndefined();
    expect(r.item.dataProgramada).toBeUndefined();
    expect(r.item.programacaoAtualizadaEm).toBeUndefined();
    expect(r.item.sync).toBeUndefined();
    expect(r.item.avulsaPorConflito).toEqual({ motivo: 'Programação mudou', cronogramaId: 'c1', dataProgramada: '2026-10-16', codigo: 'PROGRAMACAO_ALTERADA' });
    expect(r.item.clientEventId).toBe('e1');
  });
  it('item sem programação não vira avulsa por conflito', () => {
    expect(marcarComoAvulsaPorConflito({ ...item, cronogramaId: undefined }, 'motivo ok')).toHaveProperty('erro');
  });
});
