import { describe, expect, it } from 'vitest';
import { formatParticipantesExport } from './relatorios.execucao-participantes';

describe('formatParticipantesExport', () => {
  it('formata nomes e cargos a partir do evento de conclusão', () => {
    const formatted = formatParticipantesExport({
      equipeExecutoraNome: 'ZEL-A · Zeladoria A',
      participantes: [
        { id: 'u1', nome: 'João Silva', cargo: 'Eletricista', origem: 'equipe' },
        { id: 'u2', nome: 'Maria Oliveira', cargo: null, origem: 'externo' },
      ],
    });

    expect(formatted.equipe).toBe('ZEL-A · Zeladoria A');
    expect(formatted.detalhe).toContain('João Silva — Eletricista');
    expect(formatted.detalhe).toContain('Maria Oliveira — membro externo');
    expect(formatted.ids).toBe('u1; u2');
  });
});
