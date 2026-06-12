# Fase 5 — Relatórios, observabilidade e PWA

## Implementado

### Exportação CSV
- `GET /relatorios/export/unidades.csv`
- `GET /relatorios/export/chamados.csv`
- `GET /relatorios/export/ordens-servico.csv`
- `GET /relatorios/export/fiscalizacoes.csv`
- Filtros opcionais: `secretariaId`, `status`, `from`, `to`
- Permissão: `dashboard.visualizar`
- Frontend: `/relatorios` com download direto (UTF-8 + BOM para Excel)

### Alertas operacionais
- `GET /monitoramento/alertas`
- OS atrasadas (prazo vencido)
- Chamados abertos há mais de 48h sem encerramento
- Contagem de OS urgentes e falhas de sync
- Card de alertas no **Dashboard**

### Observabilidade
- Filtro global de exceções com log estruturado (`GlobalHttpExceptionFilter`)
- `GET /health` com uptime, versão e flags de Sentry/webhook
- Webhook automático em chamado QR: evento `chamado.qr.criado`

### PWA Campo
- Service worker (`/sw.js`) com cache de shell
- Banner “Instalar app” em `/mobile`
- Notificação local após sync bem-sucedido
- Manifest atualizado (`scope: /`, orientação portrait)

## Railway — variáveis opcionais

```env
SENTRY_DSN=https://...@sentry.io/...
INTEGRACOES_WEBHOOK_URL=https://...   # alertas chamado QR e integrações
```

### Sentry (recomendado)

1. Crie projeto Node.js em [sentry.io](https://sentry.io)
2. Adicione `SENTRY_DSN` no serviço backend Railway
3. Instale `@sentry/node` e inicialize em `src/main.ts` (ver runbook)

## Testes

```bash
npm test                    # inclui relatorios.csv.spec.ts
cd frontend && npm run build
```

## Próximo (Fase 6 — escopo acordado)

Ver `docs/fase-6-implementacao.md`.

**Fora do escopo:** BI externo (Metabase/Power BI) e app nativo — o SIGMA permanece **web + PWA** no Next.js.
