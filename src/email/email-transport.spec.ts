import { describe, expect, it } from 'vitest';
import { describeSmtpError, explainSmtpError, sanitizeSmtpText } from './email-transport';

function smtpError(response: string, responseCode: number, command = 'AUTH LOGIN') {
  return Object.assign(new Error(`Invalid login: ${response}`), { code: 'EAUTH', response, responseCode, command });
}

describe('describeSmtpError (#320 M0)', () => {
  it('M365 com SMTP AUTH desabilitado não vira "senha incorreta"', () => {
    const info = describeSmtpError(
      smtpError('535 5.7.139 Authentication unsuccessful, basic authentication is disabled. [CP6P284CA0063.BRAP284.PROD.OUTLOOK.COM]', 535),
    );
    expect(info.mensagem).toMatch(/autenticação básica/);
    expect(info.mensagem).not.toMatch(/senha recusad/i);
    expect(info.tecnico).toContain('code=EAUTH');
    expect(info.tecnico).toContain('responseCode=535');
    expect(info.tecnico).toContain('status=5.7.139');
  });

  it('credencial inválida M365 (5.7.3) é rotulada como usuário/senha', () => {
    const info = describeSmtpError(smtpError('535 5.7.3 Authentication unsuccessful [XYZ]', 535));
    expect(info.mensagem).toMatch(/Usuário ou senha recusados/);
    expect(info.enhancedStatus).toBe('5.7.3');
  });

  it('535 genérico sem status aprimorado mostra o código, não "senha"', () => {
    const msg = explainSmtpError(smtpError('535 Error', 535));
    expect(msg).toContain('535');
    expect(msg).not.toMatch(/senha/i);
  });

  it('5.7.57 e 5.7.60 têm mensagens próprias', () => {
    expect(explainSmtpError(smtpError('530 5.7.57 Client not authenticated to send mail', 530, 'MAIL FROM'))).toMatch(/exige autenticação/);
    expect(explainSmtpError(smtpError('550 5.7.60 SMTP; Client does not have permissions to send as this sender', 550, 'MAIL FROM'))).toMatch(/Remetente não autorizado/);
  });

  it('log técnico nunca contém a credencial', () => {
    const pass = 'S3nh@Sup3rS3cr3ta!';
    const user = 'caixa@exemplo.gov.br';
    const err = smtpError(`535 5.7.3 Authentication unsuccessful user=${user} pass=${pass} AUTH PLAIN AGNhaXhhQGV4ZW1wbG8uZ292LmJyAFMzbmhA`, 535, `AUTH PLAIN AGNhaXhhQGV4ZW1wbG8uZ292LmJyAFMzbmhA`);
    const info = describeSmtpError(err, [pass, user]);
    expect(info.tecnico).not.toContain(pass);
    expect(info.tecnico).not.toContain(user);
    expect(info.tecnico).not.toContain('AGNhaXhhQGV4ZW1wbG8uZ292LmJyAFMzbmhA');
    expect(info.mensagem).not.toContain(pass);
  });

  it('erros de rede continuam mapeados', () => {
    expect(explainSmtpError(Object.assign(new Error('getaddrinfo ENOTFOUND smtp.x'), { code: 'EDNS' }))).toBe('Servidor SMTP inválido.');
    expect(sanitizeSmtpText('Bearer abc.def')).toBe('Bearer ***');
  });
});
