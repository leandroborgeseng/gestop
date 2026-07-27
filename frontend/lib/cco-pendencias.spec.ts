import { describe, expect, it } from 'vitest';
import { countChamadosPendenciasUnicas, countUnidadesPendenciasUnicas } from './cco-pendencias';
import { ChamadoMapaItem, UnidadeOperacional } from './types';

function chamado(partial: Partial<ChamadoMapaItem> & Pick<ChamadoMapaItem, 'id' | 'status'>): ChamadoMapaItem {
  return {
    codigo: 'CH-1',
    titulo: null,
    descricao: '',
    prioridade: 'MEDIA',
    origem: 'MANUAL',
    prazoEm: null,
    previstaExecucaoEm: null,
    enderecoTexto: null,
    enderecoBairro: null,
    latitude: null,
    longitude: null,
    mapaLatitude: null,
    mapaLongitude: null,
    slaMapa: null,
    createdAt: new Date().toISOString(),
    secretaria: { id: 's', nome: 'S', sigla: 'S' },
    unidade: null,
    equipe: null,
    tipoChamado: null,
    responsavel: null,
    ...partial,
  };
}

describe('cco-pendencias', () => {
  it('conta 1 chamado mesmo quando SLA está fora do prazo', () => {
    const items = [
      chamado({ id: 'c1', status: 'ABERTO', slaMapa: 'FORA' }),
    ];
    expect(countChamadosPendenciasUnicas(items)).toBe(1);
  });

  it('nao conta chamados concluidos ou cancelados', () => {
    const items = [
      chamado({ id: 'c1', status: 'CONCLUIDO', slaMapa: null }),
      chamado({ id: 'c2', status: 'CANCELADO', slaMapa: null }),
      chamado({ id: 'c3', status: 'EM_EXECUCAO', slaMapa: 'DENTRO' }),
    ];
    expect(countChamadosPendenciasUnicas(items)).toBe(1);
  });

  it('soma pendenciasUnicas dos proprios sem duplicar SLA', () => {
    const unidades = [
      {
        pendenciasUnicas: 1,
        pendencias: { naoConformidadesAbertas: 1, chamadosAbertos: 1, semVistoria: false },
      },
      {
        pendenciasUnicas: 2,
        pendencias: { naoConformidadesAbertas: 0, chamadosAbertos: 2, semVistoria: false },
      },
    ] as UnidadeOperacional[];

    expect(countUnidadesPendenciasUnicas(unidades, ['CHAMADOS', 'NAO_CONFORMIDADES', 'VISTORIAS'])).toBe(3);
  });
});
