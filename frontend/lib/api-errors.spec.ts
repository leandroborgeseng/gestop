import { describe, expect, it } from 'vitest';
import { ACESSO_NEGADO_GENERICO, extractApiErrorMessage, readForbiddenMessage } from './api-errors';

const res = (body: unknown) => ({ json: async () => body });
const resInvalido = () => ({ json: async () => { throw new SyntaxError('not json'); } });

describe('292 · mensagem do 403 (api.ts)', () => {
  it('mostra a mensagem do backend no 403 (escopo de Secretaria)', async () => {
    const msg = 'Este próprio pertence a outra Secretaria.';
    await expect(readForbiddenMessage(res({ statusCode: 403, message: msg }))).resolves.toBe(msg);
  });

  it('usa o texto genérico só quando o backend não manda mensagem', async () => {
    await expect(readForbiddenMessage(res({ statusCode: 403 }))).resolves.toBe(ACESSO_NEGADO_GENERICO);
    await expect(readForbiddenMessage(res({ message: '   ' }))).resolves.toBe(ACESSO_NEGADO_GENERICO);
    await expect(readForbiddenMessage(resInvalido())).resolves.toBe(ACESSO_NEGADO_GENERICO);
  });

  it('junta mensagens em array (ValidationPipe) e cai em error', () => {
    expect(extractApiErrorMessage({ message: ['a', 'b'] }, 'x')).toBe('a b');
    expect(extractApiErrorMessage({ error: 'Forbidden' }, 'x')).toBe('Forbidden');
    expect(extractApiErrorMessage(null, 'x')).toBe('x');
  });
});
