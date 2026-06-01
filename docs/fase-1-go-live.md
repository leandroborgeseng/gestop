# Fase 1 — Go-live mínimo (Railway)

Checklist para colocar o GestOP no ar **usando apenas Railway** — sem AWS.

> **Importante:** Railway hospeda o app (backend, frontend, Postgres).  
> As fotos das fiscalizações ficam no **Volume persistente** do serviço backend, não em AWS/S3.

---

## 1. Arquitetura no Railway

```
GitHub (main)
    │
    ▼
Railway Project
├── PostgreSQL          ← DATABASE_URL
├── Backend (NestJS)    ← Volume /data para fotos
└── Frontend (Next.js)  ← URL pública + proxy /api-gestop
```

---

## 2. Credenciais e segurança

### Backend — variáveis obrigatórias

```env
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=<segredo-aleatorio-com-pelo-menos-32-caracteres>
INITIAL_ADMIN_PASSWORD=<senha-forte-admin>   # só no primeiro deploy (banco vazio)

# Fotos — disco local com Volume Railway
STORAGE_DRIVER=local
STORAGE_LOCAL_DIR=/data/gestop-evidencias
STORAGE_PUBLIC_URL_BASE=https://SEU-FRONTEND.up.railway.app/api-gestop
```

### Frontend — variáveis obrigatórias

```env
NODE_ENV=production
BACKEND_INTERNAL_URL=http://${{gestop.RAILWAY_PRIVATE_DOMAIN}}:${{gestop.PORT}}
```

**Não definir:**
- `NEXT_PUBLIC_SHOW_DEMO_LOGIN`
- `NEXT_PUBLIC_API_URL`

Substitua `gestop` pelo nome do seu serviço backend no Railway.

---

## 3. Volume Railway para fotos (passo a passo)

1. Abra o serviço **Backend** no Railway
2. Aba **Volumes** → **Add Volume**
3. Mount path: `/data`
4. Configure as variáveis:
   - `STORAGE_LOCAL_DIR=/data/gestop-evidencias`
   - `STORAGE_PUBLIC_URL_BASE=https://<url-publica-do-frontend>/api-gestop`

As fotos são salvas no volume e servidas pelo backend em `/storage/*`.  
O browser acessa via proxy do frontend (`/api-gestop/storage/...`).

---

## 4. Login

- **Produção:** campos vazios — use credenciais reais
- **Local:** `NEXT_PUBLIC_SHOW_DEMO_LOGIN=true` em `frontend/.env.local`

Primeiro admin (após seed): `admin.gestop@franca.sp.gov.br` + `INITIAL_ADMIN_PASSWORD`

---

## 5. Importação dos 165 próprios

Modelo CSV: `data/unidades.template.csv`

```bash
# Validar
npm run import:unidades:dry-run data/unidades-franca.csv

# Importar (local apontando DATABASE_URL de producao, ou one-off no Railway)
npm run import:unidades data/unidades-franca.csv
```

---

## 6. CI/CD

Pipeline `.github/workflows/ci.yml` roda automaticamente no GitHub a cada push na `main`.

---

## 7. Checklist pós-deploy

- [ ] Backend subiu (logs sem erro de JWT_SECRET)
- [ ] Volume montado em `/data`
- [ ] Login funciona em `/login`
- [ ] CCO carrega mapa e unidades
- [ ] Sync mobile com foto grava URL `.../api-gestop/storage/...`
- [ ] CSV oficial importado

---

## 8. Storage externo (opcional, pós-MVP)

Se no futuro precisar de storage fora do Railway (ex.: Cloudflare R2), use `STORAGE_DRIVER=s3`.  
**Não é necessário para go-live** — o Volume Railway é suficiente.

---

## 9. Ordem de execução

1. Postgres + Backend + Frontend no Railway
2. Volume no backend
3. `JWT_SECRET` + `INITIAL_ADMIN_PASSWORD` + vars de storage
4. Deploy → login → importar CSV
5. Homologar mobile com foto real
