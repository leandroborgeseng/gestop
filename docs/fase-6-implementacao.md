# Fase 6 — PDF, Web Push e Sentry

## Implementado

### Relatórios PDF
Mesmos dados do CSV, formato A4 paisagem para impressão:
- `GET /relatorios/export/unidades.pdf`
- `GET /relatorios/export/chamados.pdf`
- `GET /relatorios/export/ordens-servico.pdf`
- `GET /relatorios/export/fiscalizacoes.pdf`

Frontend `/relatorios` — botões **CSV** e **PDF** por tipo.

### Web Push (alertas operacionais)
- Modelo `PushSubscription` + migration `20260601190000_push_subscriptions`
- `GET /notificacoes/push/vapid-public-key` (público)
- `POST /notificacoes/push/subscribe` / `unsubscribe`
- `POST /notificacoes/alertas/disparar` — manual (gestores)
- Scheduler automático a cada 6h (`ALERTAS_INTERVAL_MS`, `0` desliga)
- Alertas: OS atrasadas, chamados parados 48h+, OS urgentes, falhas sync
- Webhook `alertas.operacionais` via `INTEGRACOES_WEBHOOK_URL`
- Service worker com handler `push` + clique abre `/dashboard`
- Painel no **Dashboard** para ativar push e disparar alertas

### Sentry
- `@sentry/node` inicializado em `src/main.ts` quando `SENTRY_DSN` está definido
- Falha no bootstrap capturada no Sentry
- `GET /health` → `observability.sentryConfigured`

## Configuração Railway

```env
# Sentry (recomendado)
SENTRY_DSN=https://...@sentry.io/...
SENTRY_TRACES_SAMPLE_RATE=0.1

# Web Push — gere com: npm run vapid:generate
WEB_PUSH_VAPID_PUBLIC_KEY=...
WEB_PUSH_VAPID_PRIVATE_KEY=...
WEB_PUSH_VAPID_SUBJECT=mailto:gestop@franca.sp.gov.br

# Alertas automáticos (ms, padrão 6h)
ALERTAS_INTERVAL_MS=21600000

# Webhook municipal (opcional, complementa push)
INTEGRACOES_WEBHOOK_URL=https://...
```

## Gerar chaves VAPID

```bash
npm run vapid:generate
```

Copie as três linhas para as variáveis do backend no Railway.

## Testes

```bash
npm test
cd frontend && npm run build
```

## Escopo fechado

Plataforma **web + PWA** — sem BI externo e sem app nativo.

## Próximo (evolução opcional)

- Templates PDF com logo da Prefeitura
- E-mail transacional para alertas (via webhook/SMTP)
- Histórico de alertas disparados na UI de integrações
