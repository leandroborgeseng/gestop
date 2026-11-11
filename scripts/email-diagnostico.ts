import { resolveEnvMailDriver } from '../src/email/m365-config';
import { diagnoseEmailDelivery } from '../src/email/m365-graph.mailer';
import { diagnosticSecretValues, redactSecrets } from '../src/email/secret-redaction';

/**
 * Diagnóstico local do provedor de e-mail.
 * Com Microsoft 365 completo, obtém só o token. Não envia mensagem.
 * Códigos: 0 token ok ou provedor diferente de m365; 1 token recusado; 2 configuração m365 incompleta.
 * A saída lista presença de variáveis, nunca os valores.
 */
async function main() {
  const report = await diagnoseEmailDelivery({ fallbackDriver: resolveEnvMailDriver(process.env) });
  const text = redactSecrets(JSON.stringify(report, null, 2), diagnosticSecretValues(process.env));
  process.stdout.write(`${text}\n`);
  if (report.providerRequested === 'm365' && !report.m365.complete) {
    process.exitCode = 2;
    return;
  }
  if (report.tokenProbe.attempted && !report.tokenProbe.ok) process.exitCode = 1;
}

main().catch(() => {
  process.stderr.write('Falha ao executar o diagnóstico de e-mail.\n');
  process.exitCode = 1;
});
