import { describe, expect, it } from 'vitest';
import { paramsIguais } from '@/lib/estado-url';
import { lerEstadoDocumentos, serializarEstadoDocumentos } from '@/lib/estado-url-documentos';

describe('322 L1 · query de Documentos', () => {
  it('sem parâmetros é a lista padrão', () => {
    const { estado, canonico } = lerEstadoDocumentos(new URLSearchParams());
    expect(estado.tipo).toBe('TODOS');
    expect(estado.historico).toBe(false);
    expect(canonico.toString()).toBe('');
  });

  it('grava busca, filtros, id e preencher; mantém pendentes', () => {
    const { estado, canonico } = lerEstadoDocumentos(
      new URLSearchParams('search=ZZ&tipo=notificacao&situacao=gerado&assinatura=minha&historico=1&pendentes=1&id=doc-1&preencher=1'),
    );
    expect(estado.tipo).toBe('NOTIFICACAO');
    expect(estado.situacao).toBe('GERADO');
    expect(estado.assinatura).toBe('minha');
    expect(estado.preencher).toBe(true);
    expect(estado.pendentes).toBe(true);
    expect(paramsIguais(canonico, serializarEstadoDocumentos(estado))).toBe(true);
  });

  it('ignora tipo e situação inválidos e preencher sem id', () => {
    const { estado, canonico } = lerEstadoDocumentos(new URLSearchParams('tipo=xyz&situacao=nao&preencher=1'));
    expect(estado.tipo).toBe('TODOS');
    expect(estado.preencher).toBe(false);
    expect(canonico.toString()).toBe('');
  });
});
