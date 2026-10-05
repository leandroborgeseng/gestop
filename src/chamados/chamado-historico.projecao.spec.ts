import { describe, expect, it } from 'vitest';
import {
  CAMPOS_METADATA_HISTORICO_CHAMADO,
  projetarMetadataHistoricoChamado,
} from './chamado-historico.projecao';

describe('projetarMetadataHistoricoChamado', () => {
  it('mantém só os campos que a ficha do chamado exibe', () => {
    const projetado = projetarMetadataHistoricoChamado({
      tipo: 'HISTORY_UPDATE',
      descricao: 'Comentário visível',
      tokenInterno: 'segredo-nao-pode-sair',
      storageKeyInterna: 'evidencias/secreto.bin',
      evidenciaIds: ['ev-1'],
    });

    expect(projetado.tipo).toBe('HISTORY_UPDATE');
    expect(projetado.descricao).toBe('Comentário visível');
    expect(projetado).not.toHaveProperty('tokenInterno');
    expect(projetado).not.toHaveProperty('storageKeyInterna');
    expect(projetado).not.toHaveProperty('evidenciaIds');
    expect(Object.keys(projetado).every((campo) => (CAMPOS_METADATA_HISTORICO_CHAMADO as readonly string[]).includes(campo))).toBe(
      true,
    );
  });
});
