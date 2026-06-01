# Fase 1 — Go-live mínimo

Checklist implementado nesta fase para preparar o GestOP para produção.

## 1. Credenciais e segurança

- Login **sem credenciais pré-preenchidas** em produção
- Demo local via `NEXT_PUBLIC_SHOW_DEMO_LOGIN=true` em `frontend/.env.local`
- `JWT_SECRET` **obrigatório** em produção (mín. 32 caracteres)
- `INITIAL_ADMIN_PASSWORD` obrigatória no **primeiro seed** em produção
- Criação de usuários exige senha explícita em produção (`admin.service.ts`)

### Railway — variáveis novas (backend)

```env
NODE_ENV=production
JWT_SECRET=<segredo-aleatorio-32+>
INITIAL_ADMIN_PASSWORD=<senha-forte-admin>
STORAGE_DRIVER=s3
S3_BUCKET=gestop-evidencias
S3_REGION=auto
S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_PUBLIC_URL_BASE=https://pub-<bucket>.r2.dev/gestop
```

### Railway — variáveis (frontend)

```env
NODE_ENV=production
# NÃO definir NEXT_PUBLIC_SHOW_DEMO_LOGIN
# NÃO definir NEXT_PUBLIC_API_URL
BACKEND_INTERNAL_URL=http://${{gestop.RAILWAY_PRIVATE_DOMAIN}}:${{gestop.PORT}}
```

---

## 2. CI/CD

Pipeline em `.github/workflows/ci.yml`:

- Backend: `npm ci` → `npm test` → `npm run build`
- Frontend: `npm ci` → `npm run lint` → `npm run build`

Dispara em push/PR na branch `main`.

---

## 3. Importação de unidades (165 próprios)

### Formato CSV

Arquivo modelo: `data/unidades.template.csv`

| Coluna | Obrigatória | Exemplo |
|--------|-------------|---------|
| secretaria_sigla | Sim | SME |
| codigo_patrimonial | Sim | PMF-ESC-001 |
| nome | Sim | EMEB Prof. Florestan Fernandes |
| tipo | Sim | ESCOLA |
| endereco | Sim | Rua Major Claudiano, 1840 |
| bairro | Não | Centro |
| cep | Não | 14400-690 |
| latitude | Sim | -20.53936 |
| longitude | Sim | -47.40081 |
| raio_validacao_metros | Não | 200 |
| ativo | Não | true |

Tipos válidos: `ESCOLA`, `UBS`, `PRACA`, `PREDIO_ADMINISTRATIVO`, `ESPACO_ESPORTIVO`, `OUTRO`.

### Comandos

```bash
# Validar CSV sem gravar
npm run import:unidades:dry-run data/unidades-franca.csv

# Importar (cria ou atualiza por codigo_patrimonial)
npm run import:unidades data/unidades-franca.csv
```

**Pré-requisito:** secretarias já cadastradas (siglas do CSV devem existir no banco).

**Fluxo recomendado:**

1. Deploy com seed inicial (3 secretarias demo)
2. Substituir CSV pela planilha oficial da Prefeitura (~165 linhas)
3. Rodar import no Railway via one-off command ou localmente apontando `DATABASE_URL` de produção

---

## 4. Armazenamento de evidências

Fotos do mobile **não ficam mais como base64 no banco**.

- Desenvolvimento: `STORAGE_DRIVER=local` → arquivos em `./storage/`, servidos em `/storage/*`
- Produção: `STORAGE_DRIVER=s3` → S3, Cloudflare R2 ou MinIO

No sync mobile (`POST /mobile/sync/fiscalizacoes`), data URLs são convertidas automaticamente para objetos no storage.

Campos persistidos: `url`, `storageKey`, `checksum`, `tamanhoBytes`.

---

## 5. Validação pós-deploy

```bash
# Health backend (se exposto)
curl https://SEU-BACKEND/health/db

# Proxy frontend
curl https://SEU-FRONTEND/api/health/backend

# Login produção
# admin.gestop@franca.sp.gov.br + INITIAL_ADMIN_PASSWORD
```

Checklist:

- [ ] CI verde no GitHub
- [ ] Login sem credenciais demo
- [ ] JWT_SECRET configurado
- [ ] Storage S3/R2 funcionando (sync mobile com foto)
- [ ] CSV oficial importado
- [ ] CCO lista todas as unidades

---

## 6. Ordem de execução na Prefeitura

1. Configurar bucket R2/S3 e variáveis no Railway
2. Definir `JWT_SECRET` e `INITIAL_ADMIN_PASSWORD`
3. Deploy → seed cria admin
4. Login → trocar senha do admin (via admin ou novo usuário)
5. Importar CSV dos 165 próprios
6. Homologar CCO + mobile com foto real
