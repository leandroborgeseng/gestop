# Fase 3 — Qualidade, LGPD e integrações

## Implementado

### Integrações reais
- `POST /integracoes/notificar` envia para **webhook** quando configurado
- Variáveis:
  ```env
  INTEGRACOES_WEBHOOK_URL=https://sistema-municipal/webhook
  INTEGRACOES_WEBHOOK_SECRET=opcional
  ```
- Sem webhook → modo mock (auditoria only)

### Mapa CCO
- **Clustering** de marcadores com `leaflet.markercluster`

### LGPD
- `POST /lgpd/usuarios/:id/anonymize` — anonimiza usuário inativo
- `POST /lgpd/auditoria/purge` — remove logs antigos
- Variável: `LGPD_AUDIT_RETENTION_DAYS=365` (mín. 30)
- UI no **Admin** → seção LGPD + botão Anonimizar em usuários inativos

### Recuperação de senha
- `/recuperar-senha` → `POST /auth/forgot-password`
- `/redefinir-senha?token=...` → `POST /auth/reset-password`
- Em dev: URL de reset retornada na resposta (`devResetUrl`)
- Em prod: enviar e-mail via webhook (`PASSWORD_RESET_WEBHOOK_URL` ou `INTEGRACOES_WEBHOOK_URL`)
- Variável: `FRONTEND_PUBLIC_URL=https://seu-frontend.up.railway.app`

### Testes E2E (smoke)
```bash
cd frontend
npm run build && npm start   # terminal 1
npm run test:e2e             # terminal 2
```

### Migration
- `20260601173000_password_reset_token` — tokens de reset

## Railway — variáveis novas

```env
FRONTEND_PUBLIC_URL=https://SEU-FRONTEND.up.railway.app
INTEGRACOES_WEBHOOK_URL=https://...
LGPD_AUDIT_RETENTION_DAYS=365
```

## Próximo (Fase 4 / pós-MVP)

- Import CSV oficial (~165 unidades)
- Homologação piloto 3 secretarias
- Chamados + QR Code cidadão
- Push notifications
- Monitoramento (Sentry) + backup Postgres documentado
