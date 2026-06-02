# Runbook de operação — GestOP

Guia rápido para equipe CCO e TI da Prefeitura de Franca.

## Contatos e acessos

| Papel | Rota principal | Permissão |
|-------|----------------|-----------|
| CCO / Gestor | `/cco`, `/chamados`, `/ordens-servico` | `chamados.gerenciar`, `dashboard.visualizar` |
| Agente de campo | `/mobile` | `fiscalizacoes.executar` |
| Admin TI | `/admin` | `usuarios.gerenciar` |

Login: URL do frontend Railway. Credenciais iniciais via seed (`INITIAL_ADMIN_PASSWORD`).

**Go-live Franca:** checklist completo e roteiro de piloto em [`docs/go-live-franca.md`](./go-live-franca.md).

## Rotina diária CCO

1. Abrir **CCO** — mapa com clusters de unidades e pendências
2. Revisar **Chamados** abertos (filtro "Abertos")
3. **Iniciar triagem** → analisar descrição e unidade
4. **Converter em OS** quando houver demanda de manutenção
5. Acompanhar **Ordens de serviço** até conclusão
6. Verificar **Integrações** se houver falhas de sync mobile

## Chamado via QR Code (cidadão)

1. Cidadão escaneia QR no próprio público
2. Preenche descrição em `/chamado/{codigo_patrimonial}`
3. Recebe protocolo `CH-AAAA-NNNNNN`
4. CCO vê chamado em `/chamados` com origem `QR_CODE`

## Fiscalização em campo

1. Agente abre **Campo** (`/mobile`)
2. Baixa pacote offline (unidades + checklists)
3. Executa fiscalização com GPS e evidências
4. Sync automático ao voltar online
5. Não conformidades geram OS automaticamente (quando configurado no item)

## Importação de dados

### Secretarias (9)
```bash
npm run import:secretarias data/secretarias.template.csv
```

### Unidades (~165)
Use CSV oficial com cabeçalho:
```csv
secretaria_sigla,codigo_patrimonial,nome,tipo,endereco,bairro,cep,latitude,longitude,raio_validacao_metros,ativo
```

```bash
npm run import:unidades:dry-run data/unidades-franca.csv
npm run import:unidades data/unidades-franca.csv
```

## Verificação de saúde

| Endpoint | Uso |
|----------|-----|
| `GET /health` | Liveness |
| `GET /health/db` | Postgres + contagens |
| `npm run go-live:check` | Checklist pré-produção |

## Incidentes comuns

### Fotos/evidências não carregam
- Confirmar volume Railway montado em `/data` no backend
- Variáveis: `STORAGE_DRIVER=local`, `STORAGE_LOCAL_DIR=/data/gestop-evidencias`
- `STORAGE_PUBLIC_URL_BASE=https://FRONTEND/api-gestop`

### Login falha em produção
- Frontend **não** deve definir `NEXT_PUBLIC_API_URL`
- Backend: `CORS_ORIGINS` com URL exata do frontend
- `JWT_SECRET` com 32+ caracteres

### Sync mobile pendente
- Integrações → retry de falhas
- Verificar conectividade e token JWT válido no dispositivo

### Recuperação de senha
- `FRONTEND_PUBLIC_URL` configurado no backend
- Webhook de e-mail (`INTEGRACOES_WEBHOOK_URL` ou `PASSWORD_RESET_WEBHOOK_URL`)

## Relatórios CSV

- Rota: `/relatorios` (permissão `dashboard.visualizar`)
- Tipos: unidades, chamados, ordens de serviço, fiscalizações
- Filtros: secretaria, intervalo de datas
- API: `GET /relatorios/export/{tipo}.csv`

## Monitoramento (Sentry)

1. Crie projeto Node em [sentry.io](https://sentry.io)
2. Railway backend → `SENTRY_DSN=https://...`
3. Sentry já inicializa em `src/main.ts` quando a variável está definida
4. Verifique `GET /health` → `observability.sentryConfigured: true`

## Web Push (alertas CCO)

1. Gere chaves: `npm run vapid:generate`
2. Configure no backend Railway:
   ```env
   WEB_PUSH_VAPID_PUBLIC_KEY=...
   WEB_PUSH_VAPID_PRIVATE_KEY=...
   WEB_PUSH_VAPID_SUBJECT=mailto:gestop@franca.sp.gov.br
   ALERTAS_INTERVAL_MS=21600000
   ```
3. No **Dashboard** → **Ativar push neste dispositivo**
4. Disparo manual: **Disparar alertas agora** ou automático a cada 6h
5. Webhook complementar: evento `alertas.operacionais`

## Relatórios PDF

- Mesma tela `/relatorios` — botão **PDF** ao lado do CSV
- API: `GET /relatorios/export/{tipo}.pdf`

## PWA Campo (agentes)

1. Abrir `/mobile` no Chrome/Edge Android
2. Toque em **Instalar app** (banner) ou menu → “Adicionar à tela inicial”
3. Permitir notificações para aviso de sync concluído
4. Service worker cacheia shell; fila offline continua no IndexedDB

## LGPD

- Admin → seção LGPD: purge de auditoria antiga
- Usuários inativos: anonimização via botão no cadastro
- Retenção: `LGPD_AUDIT_RETENTION_DAYS` (mín. 30)

## Backup Postgres (Railway)

1. Railway Dashboard → serviço Postgres → **Backups**
2. Habilitar backups automáticos no plano pago
3. Antes de migrations destrutivas: snapshot manual
4. Restore de emergência via `pg_dump` / `pg_restore`:

```bash
# Export local (one-off shell com DATABASE_URL)
pg_dump "$DATABASE_URL" -Fc -f gestop-backup.dump

# Restore em ambiente de homologação
pg_restore -d "$DATABASE_URL" --clean --if-exists gestop-backup.dump
```

5. Frequência recomendada: backup diário automático + dump manual antes de releases maiores

## Deploy

Push na branch `main` dispara CI (`.github/workflows/ci.yml`) e deploy Railway conectado ao GitHub.

Após deploy com migration nova:
```bash
npx prisma migrate deploy
```

No Railway, migrations rodam no start command configurado ou via one-off shell.
