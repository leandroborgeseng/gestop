# E-mail pelo Microsoft 365 (M1)

O `EmailService` envia pelo Microsoft Graph quando `EMAIL_PROVIDER=m365` e as quatro variáveis abaixo estão presentes. O token usa credencial de cliente no Entra ID (`grant_type=client_credentials`, escopo `https://graph.microsoft.com/.default`) e o envio é `POST /users/{caixa}/sendMail`. A mensagem não é copiada para Itens enviados.

Não há valor de exemplo neste documento. Nada disso entra no repositório nem no texto do pull request.

## Variáveis

| Nome | Formato |
|------|---------|
| `EMAIL_PROVIDER` | `smtp` ou `m365`. Ausente ou `smtp` mantém o fluxo atual. |
| `M365_TENANT_ID` | GUID do locatário (ID do diretório no Entra ID). |
| `M365_CLIENT_ID` | GUID do registro de aplicativo (ID do aplicativo). |
| `M365_CLIENT_SECRET` | Valor do segredo do aplicativo, não o identificador do segredo. Só no cofre. |
| `M365_SENDER` | UPN ou endereço da caixa que envia (`usuario@dominio`). |

Se `EMAIL_PROVIDER` não for `m365`, ou se faltar qualquer `M365_*`, o envio segue o fluxo já existente (SMTP da tela ou do ambiente, webhook ou log). Nesse caso o log recebe um aviso com os **nomes** das variáveis ausentes, sem os valores. `EMAIL_PROVIDER=smtp` ou ausente não gera esse aviso.

O token fica em memória e é renovado cerca de um minuto antes de expirar. Um HTTP 401 no envio descarta o token, pede outro e tenta uma vez. 403, 429 e 5xx não entram em repetição. A resposta e o log trazem o status e uma frase em português. Não trazem segredo, token, locatário, aplicativo nem caixa.

## Diagnóstico

Não envia e-mail.

```bash
npm run email:diagnostico
```

Roda no checkout do repositório, com as variáveis do ambiente e com `tsx` instalado. Não é rota pública e não vai na imagem enxuta da API. Na API em execução, use o endpoint abaixo. Códigos de saída:

| Código | Significado |
|--------|-------------|
| 0 | Token obtido, ou o provedor ativo não é o Microsoft 365. |
| 1 | Configuração completa, mas o Entra ID recusou o token. |
| 2 | `EMAIL_PROVIDER=m365` com alguma variável ausente. |

A mesma consulta autenticada, com a permissão de **executar** da aba E-mail (a mesma de `POST /admin/email/teste`):

```http
POST /admin/email/diagnostico
```

O JSON diz qual provedor está ativo, se a configuração daquele provedor está completa e se cada variável está presente (`true`/`false`). O campo `missing` lista nomes. Não inclui os valores nem o token. `GET /health` continua só com `observability.emailConfigured` (boolean).

## O que fica fora do código

Registro do aplicativo, consentimento e cofre são feitos por quem administra o Entra ID:

1. Registrar o aplicativo no Entra ID do locatário.
2. Anotar o ID do locatário e o ID do aplicativo.
3. Criar um segredo de cliente e guardar o **valor** no cofre do ambiente.
4. Definir a conta remetente (`M365_SENDER`) que existe nesse locatário.
5. Conceder a permissão de aplicativo **Mail.Send** e o consentimento de administrador.

Esses cinco itens não são gravados no Git. Sem eles o diagnóstico de token falha ou o provedor nem chega a ser ativado, e o SMTP atual permanece.
