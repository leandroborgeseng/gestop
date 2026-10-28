import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { REQUIRED_PERMISSIONS_KEY } from '../auth/permissions';
import { catalogEntryForKey, listCatalogMatrixKeys } from '../domain/permissions-catalog';
import { FiscalizacoesController } from './fiscalizacoes.controller';
import {
  applyFiscalizacaoOperacionalFilter,
  normalizarMotivoExclusao,
  podeExcluirVistoria,
  podeVisualizarVistoriasExcluidas,
  VISTORIA_EXCLUIDAS_VISUALIZAR,
  VISTORIA_EXCLUIR,
} from './fiscalizacao-exclusao';

const sessao = (permissoes: string[]) => ({ permissoes, perfis: ['Perfil fictício 305'] });

describe('305 · exclusão lógica de vistorias (unit)', () => {
  it('E1/E4: duas permissões — Excluir (ação existente da tela) e Visualizar excluídas (subfunção nova no catálogo)', () => {
    expect(VISTORIA_EXCLUIR).toBe('matriz.vistorias._tela.excluir');
    expect(VISTORIA_EXCLUIDAS_VISUALIZAR).toBe('matriz.vistorias.excluidas_visualizar.visualizar');
    const chaves = listCatalogMatrixKeys();
    expect(chaves).toContain(VISTORIA_EXCLUIR);
    expect(chaves).toContain(VISTORIA_EXCLUIDAS_VISUALIZAR);
    expect(catalogEntryForKey(VISTORIA_EXCLUIDAS_VISUALIZAR)?.funcao.label).toBe('Visualizar excluídas');
    expect(podeExcluirVistoria(sessao([VISTORIA_EXCLUIR]))).toBe(true);
    expect(podeExcluirVistoria(sessao([VISTORIA_EXCLUIDAS_VISUALIZAR]))).toBe(false);
    expect(podeVisualizarVistoriasExcluidas(sessao([VISTORIA_EXCLUIR]))).toBe(false);
    expect(podeVisualizarVistoriasExcluidas(sessao([VISTORIA_EXCLUIDAS_VISUALIZAR]))).toBe(true);
  });

  it('E1: a rota POST /fiscalizacoes/:id/exclusao exige a permissão Excluir no guard (403 antes do service)', () => {
    const meta = Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, FiscalizacoesController.prototype.excluir);
    expect(meta).toEqual([VISTORIA_EXCLUIR]);
  });

  it('E1: motivo obrigatório, normalizado (20 a 1000 caracteres)', () => {
    expect(normalizarMotivoExclusao(undefined)).toBeNull();
    expect(normalizarMotivoExclusao(123)).toBeNull();
    expect(normalizarMotivoExclusao('    ')).toBeNull();
    expect(normalizarMotivoExclusao('x'.repeat(19))).toBeNull();
    expect(normalizarMotivoExclusao('  duplicada   no   lançamento manual ')).toBe('duplicada no lançamento manual');
    expect(normalizarMotivoExclusao('x'.repeat(1001))).toBeNull();
  });

  it('E3: filtro central acrescenta "não excluída" em toda leitura que não cite excluidoEm', () => {
    expect(applyFiscalizacaoOperacionalFilter(undefined)).toEqual({ where: { excluidoEm: null } });
    expect(applyFiscalizacaoOperacionalFilter({ where: {} })).toEqual({ where: { excluidoEm: null } });
    expect(applyFiscalizacaoOperacionalFilter({ where: { status: 'CONCLUIDA' } })).toEqual({
      where: { AND: [{ status: 'CONCLUIDA' }, { excluidoEm: null }] },
    });
    // Quem cita excluidoEm (Mostrar excluídas, baixa da programação) decide sozinho.
    const comExcluidas = { where: { AND: [{ unidadeId: 'u' }, { OR: [{ excluidoEm: null }, { excluidoEm: { not: null } }] }] } };
    expect(applyFiscalizacaoOperacionalFilter(comExcluidas)).toBe(comExcluidas);
  });
});
