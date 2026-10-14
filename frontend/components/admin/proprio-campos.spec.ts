import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  atributosCampoProprio,
  CampoSecretariaProprio,
  CampoSelecaoProprio,
  RodapeSheetProprio,
  tituloSheetProprio,
} from './proprio-campos';
import { salvarEdicaoProprio, secretariaIdDoFormulario } from '@/lib/admin-proprios';
import { readForbiddenMessage } from '@/lib/api-errors';

const SECRETARIAS = [
  { value: 'sec-sme', label: 'SME · Educação' },
  { value: 'sec-sms', label: 'SMS · Saúde' },
];

/** Monta o FormData como o navegador: só entra controle com `name` que não esteja `disabled`. */
function formDataDoHtml(html: string) {
  const form = new FormData();
  const re = /<(input|select)\b([^>]*)>/g;
  for (const m of html.matchAll(re)) {
    const attrs = m[2];
    if (/\sdisabled(="|\s|\/|$)/.test(attrs)) continue;
    const name = /\sname="([^"]*)"/.exec(attrs)?.[1];
    if (!name) continue;
    form.set(name, /\svalue="([^"]*)"/.exec(attrs)?.[1] ?? '');
  }
  return form;
}

describe('292 · nota 1 · perfil só Visualizar', () => {
  it('campos ficam readOnly, nunca disabled, com texto no mínimo --ink-3', () => {
    const attrs = atributosCampoProprio(true);
    expect(attrs).toMatchObject({ readOnly: true });
    expect(attrs).not.toHaveProperty('disabled');
    expect(attrs.className).toContain('text-[var(--ink-3)]');
    expect(attrs.className).not.toMatch(/ink-4|opacity/);
    expect(atributosCampoProprio(false)).toEqual({});
  });

  it('select em somente leitura vira input readOnly com o rótulo, sem select nem disabled', () => {
    const html = renderToStaticMarkup(
      createElement(CampoSelecaoProprio, {
        name: 'tipo',
        value: 'escola',
        somenteLeitura: true,
        opcoes: [{ value: 'escola', label: 'Escola' }],
        children: createElement('option', { value: 'escola' }, 'Escola'),
      }),
    );
    expect(html).not.toContain('<select');
    expect(html).not.toMatch(/\sdisabled(=|\s|>)/);
    expect(html).toMatch(/readOnly|readonly/i);
    expect(html).toContain('value="Escola"');
    expect(html).toContain('text-[var(--ink-3)]');
  });

  it('título é "Visualizar próprio" e o rodapé tem só "Fechar"', () => {
    expect(tituloSheetProprio(undefined, false)).toBe('Visualizar próprio');
    expect(tituloSheetProprio('EMEF Centro', false)).toMatch(/^Visualizar próprio/);
    expect(tituloSheetProprio('EMEF Centro', true)).toBe('Editar — EMEF Centro');

    const onClose = vi.fn();
    const html = renderToStaticMarkup(createElement(RodapeSheetProprio, { podeSalvar: false, formId: 'f', onClose }));
    const botoes = [...html.matchAll(/<button\b[^>]*>(.*?)<\/button>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').trim());
    expect(botoes).toEqual(['Fechar']);
    expect(html).not.toContain('type="submit"');
  });

  it('com Alterar o rodapé mantém Salvar alterações + Cancelar', () => {
    const html = renderToStaticMarkup(createElement(RodapeSheetProprio, { podeSalvar: true, formId: 'f', onClose: () => {} }));
    expect(html).toContain('Salvar alterações');
    expect(html).toContain('Cancelar');
  });
});

describe('292 · nota 2 · Secretaria travada entra no envio', () => {
  it('travada: o id da secretaria ativa entra no FormData e nada fica disabled', () => {
    const html = renderToStaticMarkup(
      createElement(CampoSecretariaProprio, { travada: true, valor: 'sec-sme', opcoes: SECRETARIAS }),
    );
    expect(html).not.toMatch(/\sdisabled(=|\s|>)/);
    expect(html).toContain('SME · Educação');
    const form = formDataDoHtml(html);
    expect(form.get('secretariaId')).toBe('sec-sme');
    // helper existente continua valendo
    expect(secretariaIdDoFormulario(form, { secretariaAtivaId: 'sec-sme', escopoTodas: false })).toBe('sec-sme');
  });

  it('“Todas”: select livre com name secretariaId', () => {
    const html = renderToStaticMarkup(
      createElement(CampoSecretariaProprio, { travada: false, valor: 'sec-sms', opcoes: SECRETARIAS }),
    );
    expect(html).toContain('<select');
    expect(html).toContain('name="secretariaId"');
    expect(html).not.toMatch(/\sdisabled(=|\s|>)/);
  });
});

describe('292 · nota 3 · 403 de escopo', () => {
  const textoBackend = 'Próprio fora da Secretaria ativa (SME).';

  function mutateComSnackbar(show: (msg: string, tipo: string) => void) {
    // mesmo tratamento do `mutate` da página de Administração
    return async (action: () => Promise<unknown>, message: string) => {
      try {
        await action();
        show(message, 'success');
        return true;
      } catch (err) {
        show(err instanceof Error ? err.message : 'Operação não concluída.', 'error');
        return false;
      }
    };
  }

  it('mostra o texto do backend no snackbar e não fecha o modal', async () => {
    const show = vi.fn();
    const fechar = vi.fn();
    const resposta = { json: async () => ({ statusCode: 403, message: textoBackend }) };
    const ok = await salvarEdicaoProprio(
      mutateComSnackbar(show),
      async () => {
        throw new Error(await readForbiddenMessage(resposta));
      },
      'Próprio atualizado.',
      fechar,
    );
    expect(ok).toBe(false);
    expect(show).toHaveBeenCalledWith(textoBackend, 'error');
    expect(fechar).not.toHaveBeenCalled();
  });

  it('sucesso fecha o modal', async () => {
    const fechar = vi.fn();
    const ok = await salvarEdicaoProprio(mutateComSnackbar(() => {}), async () => ({}), 'ok', fechar);
    expect(ok).toBe(true);
    expect(fechar).toHaveBeenCalledTimes(1);
  });
});
