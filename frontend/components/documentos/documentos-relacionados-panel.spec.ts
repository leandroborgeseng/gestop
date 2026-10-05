import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildMatrixKey } from '@/lib/permissions-matrix';
import type { DocumentoResumo } from '@/lib/types';
import {
  assinaturasVigentesDoCard,
  resolvePodeColetar,
  rotuloAssinaturaVigente,
  rotuloSignatarioPendente,
  signatariosPendentesDoCard,
} from '@/components/documentos/documentos-relacionados-acoes';

const PANEL_SRC = readFileSync(
  resolve(__dirname, './documentos-relacionados-panel.tsx'),
  'utf8',
);

function resumo(partial: Partial<DocumentoResumo> = {}): DocumentoResumo {
  return {
    id: 'doc-1',
    codigo: 'DOC-2026-001',
    codigoValidacao: 'ABC123',
    tipo: 'DOCUMENTO_AVULSO',
    situacao: 'ASSINATURA_PENDENTE',
    origem: 'AVULSO',
    titulo: 'Documento teste',
    possuiPdfOriginal: true,
    possuiPdfAssinado: false,
    assinaturas: [],
    createdAt: '2026-10-05T10:00:00Z',
    updatedAt: '2026-10-05T10:00:00Z',
    ...partial,
  };
}

describe('DocumentosRelacionadosPanel (código real)', () => {
  it('usa resolvePodeColetar (não o acesso ao módulo) no botão Coletar', () => {
    expect(PANEL_SRC).toMatch(/const podeColetar = resolvePodeColetar\(permissoes\)/);
    expect(PANEL_SRC).not.toMatch(/const podeColetar = hasDocumentosModuloAccess\(permissoes\)/);
  });

  it('lista signatários pendentes no card com o helper real', () => {
    expect(PANEL_SRC).toContain('signatariosPendentesDoCard');
    expect(PANEL_SRC).toContain('Signatários pendentes:');
    expect(PANEL_SRC).toContain('rotuloSignatarioPendente');
  });

  it('usuário com módulo Documentos mas sem coletar_assinatura não pode coletar', () => {
    const permissoes = [
      buildMatrixKey('documentos', '_tela', 'visualizar'),
      buildMatrixKey('documentos', 'consultar', 'visualizar'),
      'documentos.visualizar',
    ];
    expect(resolvePodeColetar(permissoes)).toBe(false);
  });

  it('usuário com documentos.coletar_assinatura pode coletar', () => {
    expect(resolvePodeColetar(['documentos.visualizar', 'documentos.coletar_assinatura'])).toBe(true);
  });

  it('usuário com chave de matriz coletar_assinatura.executar pode coletar', () => {
    expect(
      resolvePodeColetar([buildMatrixKey('documentos', 'coletar_assinatura', 'executar')]),
    ).toBe(true);
  });

  it('lista signatários pendentes com nome e e-mail', () => {
    const item = resumo({
      signatariosPendentes: [
        { id: 'sp1', nome: 'João Silva', email: 'joao@example.com', meu: false },
        { id: 'sp2', nome: 'Maria Santos', email: null, meu: false },
      ],
    });
    const pendentes = signatariosPendentesDoCard(item);
    expect(pendentes).toHaveLength(2);
    expect(rotuloSignatarioPendente(pendentes[0])).toBe('João Silva (joao@example.com)');
    expect(rotuloSignatarioPendente(pendentes[1])).toBe('Maria Santos');
  });

  it('documento sem signatários (ausente ou vazio) não quebra', () => {
    expect(signatariosPendentesDoCard(resumo())).toEqual([]);
    expect(signatariosPendentesDoCard(resumo({ signatariosPendentes: [] }))).toEqual([]);
    const semCampo = resumo();
    delete (semCampo as { signatariosPendentes?: unknown }).signatariosPendentes;
    expect(signatariosPendentesDoCard(semCampo)).toEqual([]);
    expect(assinaturasVigentesDoCard(resumo())).toEqual([]);
  });

  it('lista assinaturas vigentes com papel quando houver', () => {
    const item = resumo({
      assinaturas: [
        {
          id: 'a1',
          assinanteNome: 'Ana Costa',
          qualificacao: 'Fiscal',
          canal: 'INTERNA',
          coletadaEm: '2026-10-05T12:00:00Z',
        },
      ],
    });
    const assinados = assinaturasVigentesDoCard(item);
    expect(assinados).toHaveLength(1);
    expect(rotuloAssinaturaVigente(assinados[0])).toBe('Ana Costa (Fiscal)');
  });
});
