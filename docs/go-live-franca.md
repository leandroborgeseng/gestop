# Go-live Franca — Checklist e piloto (2 semanas)

Guia operacional para colocar o GestOP em produção na Prefeitura de Franca/SP enquanto o redesign de interface está em andamento.

**URLs produção (referência):**
- Frontend: https://gestop.up.railway.app
- Admin: `admin.gestop@franca.sp.gov.br`

---

## Parte A — Checklist Railway (antes do piloto)

### Serviço Backend (`gestop`, root `/`)

| Variável | Obrigatória | Valor / exemplo |
|----------|-------------|-----------------|
| `DATABASE_URL` | Sim | Injetada pelo Postgres Railway |
| `JWT_SECRET` | Sim | Segredo aleatório ≥ 32 caracteres |
| `NODE_ENV` | Sim | `production` |
| `INITIAL_ADMIN_PASSWORD` | Sim* | Senha forte (≥ 12 chars) — trocar após go-live |
| `STORAGE_DRIVER` | Sim | `local` |
| `STORAGE_LOCAL_DIR` | Sim | `/data/gestop-evidencias` |
| `STORAGE_PUBLIC_URL_BASE` | Sim | `https://gestop.up.railway.app/api-gestop` |
| `CORS_ORIGINS` | Sim | `https://gestop.up.railway.app` |
| `FRONTEND_PUBLIC_URL` | Sim | `https://gestop.up.railway.app` |
| `PORT` | Auto | Railway injeta |

**Observabilidade e alertas:**

| Variável | Recomendada | Descrição |
|----------|-------------|-----------|
| `SENTRY_DSN` | Sim | Erros em produção |
| `SENTRY_TRACES_SAMPLE_RATE` | Não | `0.1` |
| `WEB_PUSH_VAPID_PUBLIC_KEY` | Sim | `npm run vapid:generate` |
| `WEB_PUSH_VAPID_PRIVATE_KEY` | Sim | Par da chave acima |
| `WEB_PUSH_VAPID_SUBJECT` | Sim | `mailto:gestop@franca.sp.gov.br` |
| `ALERTAS_INTERVAL_MS` | Não | `21600000` (6h) ou `0` desliga |
| `INTEGRACOES_WEBHOOK_URL` | Não | Webhook municipal (Teams/Slack/n8n) |

**E-mail transacional:**

| Variável | Recomendada | Descrição |
|----------|-------------|-----------|
| `EMAIL_DRIVER` | Sim | `smtp` em produção |
| `SMTP_HOST` | Se SMTP | Ex.: `smtp.office365.com` |
| `SMTP_PORT` | Se SMTP | `587` |
| `SMTP_SECURE` | Se SMTP | `false` para STARTTLS |
| `SMTP_USER` | Se SMTP | Conta de envio |
| `SMTP_PASSWORD` | Se SMTP | Senha ou app password |
| `EMAIL_FROM` | Sim | `GestOP <gestop@franca.sp.gov.br>` |
| `EMAIL_ALERTS_ENABLED` | Não | `true` — alertas operacionais por e-mail |

**Webmap QGIS:**

| Variável | Recomendada | Descrição |
|----------|-------------|-----------|
| `WEBMAP_CRON_SECRET` | Sim | Header `X-Webmap-Cron-Secret` no cron |
| `WEBMAP_WEBHOOK_SECRET` | Não | Webhook GitHub → sync automática |
| `GITHUB_TOKEN` | Não | Evita rate limit da API |
| `WEBMAP_SKIP_NOTIFY_THRESHOLD` | Não | `10` — alerta se muitas ignoradas |

**Volume Railway (backend):**
- Mount path: `/data`
- Confirme upload de foto em fiscalização/chamado após deploy

### Serviço Frontend (`frontend/`)

| Variável | Obrigatória | Valor |
|----------|-------------|-------|
| `BACKEND_INTERNAL_URL` | Sim | URL rede privada do backend |
| `NODE_ENV` | Sim | `production` |

**Não definir** `NEXT_PUBLIC_API_URL` em produção.

---

## Parte B — Verificação automatizada

```bash
# Smoke HTTP contra produção (sem DATABASE_URL)
npm run prod:smoke

# Checklist completo com banco (Railway one-off ou local com DATABASE_URL de prod)
npm run go-live:check

# Backup manual do Postgres
npm run backup:db

# Testes unitários backend
npm test

# E2E (local — frontend + backend rodando)
cd frontend
E2E_ADMIN_EMAIL=admin.gestop@franca.sp.gov.br E2E_ADMIN_PASSWORD='***' npm run test:e2e

# E2E contra produção (smoke)
PLAYWRIGHT_BASE_URL=https://gestop.up.railway.app npm run test:e2e
```

### Critérios de “pronto para piloto”

- [ ] `prod:smoke` sem falhas críticas (login, health, QR piloto, migrations)
- [ ] `go-live:check` sem falhas críticas (com DATABASE_URL)
- [ ] ≥ 9 secretarias ativas
- [ ] ≥ 300 unidades ativas (webmap importado)
- [ ] Login admin OK
- [ ] `/cco` com mapa populado
- [ ] Chamado público QR retorna protocolo
- [ ] Foto/evidência persiste (volume `/data`)
- [ ] Recuperação de senha envia e-mail (SMTP configurado)
- [ ] Sentry recebendo eventos de teste
- [ ] Cron webmap configurado (sync diária)
- [ ] Backup Postgres testado (`npm run backup:db`)

---

## Parte C — Cron e webhook (Railway + GitHub)

### Sync diária (Railway Cron Job)

```
POST https://gestop.up.railway.app/api-gestop/admin/importacao/webmap/automation/cron
Header: X-Webmap-Cron-Secret: <WEBMAP_CRON_SECRET>
Schedule: 0 9 * * *   (6h BRT = 9h UTC)
```

### Webhook GitHub (repo SMMAFRANCA/webmap)

- URL: `https://gestop.up.railway.app/api-gestop/admin/importacao/webmap/automation/webhook`
- Content type: `application/json`
- Secret: mesmo valor de `WEBMAP_WEBHOOK_SECRET`
- Event: `push` (branch `main`)

---

## Parte D — Piloto operacional (2 semanas)

### Equipe mínima

| Papel | Qtd | Perfil GestOP |
|-------|-----|---------------|
| Gestor CCO | 2 | Gestor CCO |
| Agente de campo | 3 | Agente de Campo |
| Manutenção | 1 | Operador de Manutencao |
| TI / Admin | 1 | Administrador do Sistema |

### Semana 1 — Setup e fluxo básico

| Dia | Atividade | Responsável | Critério de sucesso |
|-----|-----------|-------------|---------------------|
| **1** | Import **Secretarias + Webmap** no painel Admin | TI | ≥ 300 unidades no `/cco` |
| **1** | Cadastrar usuários reais (perfis corretos) | TI | 7 logins ativos |
| **2** | Publicar 1 checklist (UBS ou escola) | Gestor CCO | Versão PUBLICADA |
| **2** | Treino 30 min: login, CCO, chamados | TI + Gestor | Equipe navega sem ajuda |
| **3** | Imprimir QR em 3 unidades piloto | Gestor | QR abre `/chamado/{codigo}` |
| **3** | Cidadão teste abre chamado via QR | Gestor | Protocolo `CH-AAAA-NNNNNN` |
| **4** | Triagem → OS → conclusão (1 chamado completo) | Gestor CCO | OS status CONCLUIDA |
| **5** | Fiscalização mobile offline (1 unidade) | Agente | Sync OK em Integrações |

**Entregável semana 1:** 1 chamado QR + 1 OS + 1 fiscalização documentados (print ou protocolo).

### Semana 2 — Escala e feedback

| Dia | Atividade | Responsável | Critério de sucesso |
|-----|-----------|-------------|---------------------|
| **8** | Ampliar QR para 10 unidades | Gestor | 10 códigos patrimoniais ativos |
| **9** | 3 agentes em campo simultâneos | Agentes | Zero falha crítica de sync |
| **10** | Relatório PDF para reunião de gestão | Gestor | PDF gerado em `/relatorios` |
| **11** | Revisar unidades ignoradas do webmap | TI + SMMA | CSV enviado ao QGIS |
| **12** | Ativar push no Dashboard (gestores) | Gestor | Notificação recebida |
| **13** | Simulação de incidente (senha, foto) | TI | Runbook `docs/runbook-operacao.md` seguido |
| **14** | Retrospectiva + backlog pós-piloto | Todos | Lista priorizada |

**Entregável semana 2:** Ata de retrospectiva + decisão go/no-go para ampliação.

---

## Parte E — Coleta de feedback (modelo)

Para cada incidente ou dificuldade, registrar:

```
Data:
Usuário / perfil:
Rota (ex.: /cco, /mobile):
O que tentou fazer:
O que aconteceu:
Severidade: bloqueante | incômodo | sugestão
```

Consolidar ao final da semana 2 e separar:
- **Bug técnico** → backlog dev (prioridade alta se bloqueante)
- **Dado faltando** → SMMA / secretarias
- **UX confusa** → aguardar redesign (Claude Design) ou hotfix mínimo

---

## Parte F — Segurança pós go-live (primeira semana)

- [ ] Trocar `INITIAL_ADMIN_PASSWORD` e senhas de demo
- [ ] Revisar usuários com perfil Administrador
- [ ] Confirmar `JWT_SECRET` não está no repositório
- [ ] LGPD: aviso no formulário público de chamado (QR)
- [ ] Backup agendado (Railway Postgres ou `npm run backup:db` semanal)

---

## Parte G — Monitoramento externo (15 min)

Serviço gratuito (UptimeRobot, Better Stack, etc.):

| URL | Intervalo | Alerta |
|-----|-----------|--------|
| `https://gestop.up.railway.app/login` | 5 min | E-mail TI |
| `https://gestop.up.railway.app/api/health/backend` | 5 min | E-mail TI |

---

## Referências

- [Runbook de operação](./runbook-operacao.md)
- [Publicação Railway](./publicacao-github-railway.md)
- [Importação webmap](./import-webmap.md)
- [Brief redesign UI](./claude-design-brief.md)
