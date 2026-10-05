import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DocumentoRelacionadoCard } from './documento-relacionado-card';
import type { DocumentoResumo } from '@/lib/types';

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
    possuiPdfAssinado: true,
    assinaturas: [],
    createdAt: '2026-10-05T10:00:00Z',
    updatedAt: '2026-10-05T10:00:00Z',
    ...partial,
  };
}

function renderCard(
  item: DocumentoResumo,
  permissoes: string[],
  extra: Partial<Parameters<typeof DocumentoRelacionadoCard>[0]> = {},
) {
  return renderToStaticMarkup(
    createElement(DocumentoRelacionadoCard, {
      item,
      permissoes,
      podePreencher: false,
      podeAssinar: false,
      podeEncaminhar: false,
      canAbrirCadastro: false,
      ocultarCadastroSemPermissao: true,
      onAcao: () => undefined,
      onPdfOriginal: () => undefined,
      onPdfAssinado: () => undefined,
      ...extra,
    }),
  );
}

describe('DocumentoRelacionadoCard', () => {
  it('não mostra Coletar só com acesso ao módulo Documentos', () => {
    const html = renderCard(resumo(), [
      'documentos.visualizar',
      'matriz.documentos._tela.visualizar',
      'matriz.documentos.consultar.visualizar',
    ]);
    expect(html).not.toContain('Coletar nova assinatura');
  });

  it('mostra Coletar com documentos.coletar_assinatura', () => {
    const html = renderCard(resumo(), ['documentos.coletar_assinatura']);
    expect(html).toContain('Coletar nova assinatura');
  });

  it('lista signatários internos pendentes com nome e e-mail', () => {
    const html = renderCard(
      resumo({
        signatariosPendentes: [
          { id: 'sp1', nome: 'João Silva', email: 'joao@example.com', meu: false },
          { id: 'sp2', nome: 'Maria Santos', email: null, meu: false },
        ],
      }),
      ['documentos.visualizar'],
    );
    expect(html).toContain('Signatários internos pendentes:');
    expect(html).toContain('João Silva (joao@example.com)');
    expect(html).toContain('Maria Santos');
  });

  it('documento sem signatários não quebra e não mostra o bloco de pendentes', () => {
    const html = renderCard(resumo(), ['documentos.visualizar']);
    expect(html).toContain('DOC-2026-001');
    expect(html).not.toContain('Signatários internos pendentes:');
  });

  it('mostra assinaturas vigentes e omite as inválidas', () => {
    const html = renderCard(
      resumo({
        assinaturas: [
          {
            id: 'a1',
            assinanteNome: 'Ana Costa',
            qualificacao: 'Fiscal',
            canal: 'INTERNA',
            coletadaEm: '2026-10-05T12:00:00Z',
          },
          {
            id: 'a2',
            assinanteNome: 'Externo antigo',
            qualificacao: 'Autuado',
            canal: 'EXTERNA',
            coletadaEm: '2026-10-01T12:00:00Z',
            invalida: true,
          },
        ],
      }),
      ['documentos.visualizar'],
    );
    expect(html).toContain('Assinados:');
    expect(html).toContain('Ana Costa (Fiscal)');
    expect(html).not.toContain('Externo antigo');
  });
});
