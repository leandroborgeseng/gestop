# Backup automático S3 — configuração pela UI

Administradores do sistema configuram o backup **somente pela interface**, sem editar `.env`.

## Onde configurar

1. Acesse **Administração**.
2. Abra a aba **Backup S3**.
3. Preencha bucket, região, Access Key ID e Secret Access Key.
4. Defina prefixo, horário diário (00:00–23:00) e retenção GFS (diárias / semanais / mensais).
5. Em opções avançadas (se necessário): endpoint (R2/MinIO), fuso e force path-style.
6. Marque **Ativar backup diário automático** e clique em **Salvar configuração**.

## Comportamento

- O cron é re-registrado ao salvar (`0 {hora} * * *` no fuso configurado; padrão `America/Sao_Paulo`).
- Todo dia: upload em `{prefix}/daily/`; domingo também `weekly/`; dia 1 também `monthly/`.
- Após o upload, objetos além da retenção são removidos automaticamente.
- **Executar backup agora** dispara na hora, sem reiniciar o servidor.
- A Secret Access Key nunca é devolvida pela API; deixe o campo em branco ao salvar para manter a atual.

## Restore

Na mesma aba, liste objetos no bucket e restaure com confirmação forte (`RESTAURAR`), se autorizado.
