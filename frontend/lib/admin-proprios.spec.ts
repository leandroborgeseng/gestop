import { describe, expect, it } from 'vitest';
import { capacidadesProprios, chaveProprios, secretariaIdDoFormulario, secretariaTravada } from './admin-proprios';

const SME = 'sec-sme';
const SMS = 'sec-sms';

/** FormData como o navegador monta: o select `disabled` não entra. */
function formSemSecretaria() {
  const form = new FormData();
  form.set('endereco', 'Rua Teste');
  return form;
}

describe('292 · Secretaria no payload do próprio', () => {
  it('secretaria específica: select travado não entra no FormData e o payload leva a secretaria ativa (nunca "null")', () => {
    const escopo = { secretariaAtivaId: SME, escopoTodas: false };
    expect(secretariaTravada(escopo)).toBe(true);
    const form = formSemSecretaria();
    expect(form.get('secretariaId')).toBeNull();
    expect(secretariaIdDoFormulario(form, escopo)).toBe(SME);
  });

  it('secretaria específica: ignora valor forjado no form e mantém a ativa', () => {
    const form = formSemSecretaria();
    form.set('secretariaId', SMS);
    expect(secretariaIdDoFormulario(form, { secretariaAtivaId: SME, escopoTodas: false })).toBe(SME);
  });

  it('“Todas as Secretarias”: usa a secretaria escolhida no select', () => {
    const escopo = { secretariaAtivaId: SME, escopoTodas: true };
    expect(secretariaTravada(escopo)).toBe(false);
    const form = formSemSecretaria();
    form.set('secretariaId', ` ${SMS} `);
    expect(secretariaIdDoFormulario(form, escopo)).toBe(SMS);
  });

  it('sem secretaria e sem valor: manda vazio (backend responde 400 claro, não 403)', () => {
    expect(secretariaIdDoFormulario(formSemSecretaria(), { secretariaAtivaId: null, escopoTodas: true })).toBe('');
  });
});

describe('292 · capacidades da tela de Próprios (matriz.admin.proprios.*)', () => {
  const todas = ['visualizar', 'inserir', 'alterar', 'excluir'].map((a) => `matriz.admin.proprios.${a}`);

  it('Gestor com V/I/A/E: vê, cria, salva e inativa', () => {
    expect(capacidadesProprios(todas)).toEqual({ podeVer: true, podeInserir: true, podeSalvar: true, podeInativar: true });
  });

  it('Visualizar-only: vê os dados, mas Salvar alterações não aparece', () => {
    const caps = capacidadesProprios(['matriz.admin.proprios.visualizar']);
    expect(caps.podeVer).toBe(true);
    expect(caps.podeSalvar).toBe(false);
    expect(caps.podeInserir).toBe(false);
    expect(caps.podeInativar).toBe(false);
  });

  it('Executar ou outra subfunção da Administração não liberam Salvar', () => {
    expect(capacidadesProprios(['matriz.admin.proprios.executar', 'matriz.admin.usuarios.alterar']).podeSalvar).toBe(false);
    expect(capacidadesProprios(['matriz.admin.proprios.inserir']).podeSalvar).toBe(false);
  });

  it('sem permissão em Próprios: nada liberado', () => {
    expect(capacidadesProprios(['matriz.cco._tela.visualizar'])).toEqual({
      podeVer: false, podeInserir: false, podeSalvar: false, podeInativar: false,
    });
  });

  it('Administrador do Sistema: acesso total', () => {
    expect(capacidadesProprios([], true)).toEqual({ podeVer: true, podeInserir: true, podeSalvar: true, podeInativar: true });
  });

  it('C8: chave usada pelo front é matriz.admin.proprios.<ação> (a mesma do guard do backend)', () => {
    for (const acao of ['visualizar', 'inserir', 'alterar', 'excluir'] as const) {
      expect(chaveProprios(acao)).toBe(`matriz.admin.proprios.${acao}`);
      expect(capacidadesProprios([`matriz.admin.proprios.${acao}`])).toMatchObject({
        visualizar: { podeVer: true }, inserir: { podeInserir: true }, alterar: { podeSalvar: true }, excluir: { podeInativar: true },
      }[acao]);
    }
  });
});
