# Deploy no Coolify — SIGMA

**Um recurso, um compose, deploy via Git** — mesmo padrão do SIGLM neste ambiente.

Repositório: pasta `gestop-main` (raiz do app) · branch principal do Git

```
Git push → Coolify rebuild → postgres (PostGIS) + api + web
```

---

## O que sobe no compose

| Serviço | Função | Porta |
|---------|--------|-------|
| **postgres** | PostGIS 16 (dados persistidos) | interno |
| **api** | NestJS + Prisma (`migrate deploy` + seed no boot) | 3001 |
| **web** | Next.js (proxy `/api-gestop` → api) | 3000 |

Arquivo: [`docker-compose.coolify.yml`](docker-compose.coolify.yml)

> O compose traz o banco **dentro do stack**. Se preferir Postgres gerenciado separado no Coolify, remova o serviço `postgres` e injete `DATABASE_URL` na **api**.

Arquitetura:

```
Browser → web:3000  →  proxy /api-gestop|/api-sigma  →  api:3001
                ↓
           postgres (PostGIS)
                ↓
        volume api_storage (fotos)
```

**Não use `NEXT_PUBLIC_API_URL` no browser** — o frontend sempre chama o proxy Next.js (igual Railway).

---

## Passo a passo

### 1. Criar recurso no Coolify

1. **+ New Resource** → **Docker Compose**
2. Conecte o Git → repositório do SIGMA → branch `main` (ou a branch de produção)
3. **Base Directory:** raiz do `gestop-main` (vazio se o repo for só o app; ou `gestop-main` se o repo for o monorepo SIGMA)
4. **Docker Compose Location:** `docker-compose.coolify.yml`
5. **Settings → Git** → ative **Auto Deploy** se desejar

### 2. Variáveis de ambiente

Aba **Environment** — copie de [`.env.coolify.example`](.env.coolify.example).

> **Crítico:** marque como **Available at Buildtime** (Build Variable): `POSTGRES_PASSWORD`, `JWT_SECRET`, `INITIAL_ADMIN_PASSWORD` (1º deploy).
>
> Sem `JWT_SECRET` válido (≥32 chars) a **api** aborta no entrypoint e o compose marca `unhealthy` → o **web** nunca sobe.

```env
POSTGRES_PASSWORD=senha-forte-unica
JWT_SECRET=...                    # openssl rand -base64 48  (OBRIGATÓRIO)
INITIAL_ADMIN_PASSWORD=...        # min. 12 caracteres — 1º seed (recomendado)
RUN_SEED=false
STORAGE_DRIVER=local
STORAGE_LOCAL_DIR=/data/gestop-evidencias
BACKEND_INTERNAL_URL=http://api:3001
```

| Variável | Build + Runtime | Notas |
|----------|-----------------|-------|
| `POSTGRES_PASSWORD` | ✅ ambos | **Não mude** depois do 1º deploy (volume `pgdata`) |
| `JWT_SECRET` | ✅ ambos | **Obrigatório** ≥ 32 chars; sem default no compose |
| `INITIAL_ADMIN_PASSWORD` | ✅ 1º deploy | Admin: `admin.gestop@franca.sp.gov.br` (fallback temporário `Gestop@123` se vazio) |
| `CORS_ORIGINS` | runtime | URL HTTPS do **web** (sem `/`); fallback `SERVICE_URL_WEB` |
| `STORAGE_PUBLIC_URL_BASE` | runtime | `https://seu-web/.../api-gestop` ou fallback `SERVICE_URL_WEB` |
| `BACKEND_INTERNAL_URL` | runtime | `http://api:3001` (rede Docker) |
| `RUN_SEED` | runtime | `true` só se precisar forçar re-seed |
| `WEBMAP_AUTO_IMPORT_ON_START` | runtime | `true` no 1º boot; falha de GitHub **não** derruba a API |

Opcionais: `POSTGRES_USER=gestop`, `POSTGRES_DB=gestop`, `WEBMAP_AUTO_IMPORT_ON_START=true`

### 3. Domínios

| Serviço | Exemplo | Porta container |
|---------|---------|-----------------|
| **web** | `https://sigma.seudominio.gov.br` | 3000 |
| **api** | opcional (proxy via web) | 3001 |

Na maioria dos casos **só o web precisa de domínio público** — o browser fala com a API pelo proxy `/api-gestop`. Exponha a **api** só se quiser health/debug externos.

### 4. Primeiro deploy

1. Clique **Deploy**
2. Logs da **api**:
   - `prisma migrate deploy`
   - seed (se banco vazio + `INITIAL_ADMIN_PASSWORD`)
   - eventual import webmap (`WEBMAP_AUTO_IMPORT_ON_START`)
3. Testes:
   - `GET https://sigma.../api/health` → `{"status":"ok","service":"sigma-web"}`
   - `GET https://sigma.../api/health/backend` → status ok + db
   - (se api pública) `GET https://api.../health` → ok
   - Login: `admin.gestop@franca.sp.gov.br` + senha do `INITIAL_ADMIN_PASSWORD`

### 5. Após o primeiro seed

```env
RUN_SEED=false
FORCE_SEED_ON_START=false
```

Não é necessário redeploy só por isso; evite deixar `RUN_SEED=true` em produção contínua.

---

## Ciclo de manutenção

| Ação | Como |
|------|------|
| Publicar código | `git push` → Coolify (Auto Deploy) |
| Migrations | Automáticas no boot da api (`npm start` → `prisma migrate deploy`) |
| Backup banco | Volume `pgdata` + tela Admin → Backup S3 (opcional) |
| Fotos / evidências | Volume `api_storage` → `/data/gestop-evidencias` |
| PWA | Service worker em `/sw.js`; proxy `/api-gestop` e `/api-sigma` cobertos |

---

## Teste local (mesmo compose)

```bash
cp .env.coolify.example .env
# Edite POSTGRES_PASSWORD, JWT_SECRET, INITIAL_ADMIN_PASSWORD

export $(grep -v '^#' .env | xargs)
docker compose -f docker-compose.coolify.yml up -d --build
```

Para acessar no host, adicione temporariamente `ports: ["3000:3000"]` / `["3001:3001"]` nos serviços, ou use `docker compose -f docker-compose.yml up -d` só para Postgres local (dev habitual).

---

## Checklist pós-deploy

- [ ] `/api/health` (web) OK
- [ ] `/api/health/backend` OK (db + storage)
- [ ] Login admin funciona
- [ ] Upload de foto (mobile) persiste após redeploy
- [ ] `RUN_SEED=false`
- [ ] Senha admin alterada / forte

---

## Troubleshooting

| Problema | Solução |
|----------|---------|
| **api unhealthy** / `dependency failed to start` | Quase sempre a API **crashou antes** de `/health` ou demorou mais que o grace. Veja logs do container **api** (não só o compose). Causas comuns abaixo. |
| `JWT_SECRET` fraco / ausente | Compose **não** injeta mais placeholder curto. Defina `JWT_SECRET` (≥32 chars, `openssl rand -base64 48`) como **Build Variable** e redeploy. Entrypoint aborta cedo com mensagem clara. |
| `STORAGE_PUBLIC_URL_BASE` | Compose usa `SERVICE_URL_WEB` + `/api-gestop`. Sem domínio, a API sobe com fallback temporário — defina a URL pública do **web** depois. |
| Seed / login admin | Defina `INITIAL_ADMIN_PASSWORD` (≥12). Se vazio no 1º deploy, seed usa `Gestop@123` (aviso no log) — **troque imediatamente**. |
| Import webmap lento / falha GitHub | Não derruba mais a API. Use `WEBMAP_AUTO_IMPORT_ON_START=false` se a rede outbound for bloqueada; importe pela UI depois. Healthcheck: `start_period` 180s + retries. |
| `db: error` / migrate falha | `POSTGRES_PASSWORD` diferente da 1ª subida do volume |
| Login falha / 0 usuários | Defina `INITIAL_ADMIN_PASSWORD` e redeploy; se preciso `RUN_SEED=true` uma vez |
| Proxy 502 no frontend | `BACKEND_INTERNAL_URL=http://api:3001` no serviço **web** |
| Fotos sumiram | Volume `api_storage` deve persistir; `STORAGE_LOCAL_DIR=/data/gestop-evidencias` |
| CORS | `CORS_ORIGINS` = URL exata do web (https, sem barra) |
| Build sem espaço | `docker system prune` no host Coolify |
| Import webmap lento | Rede outbound no host; ou `WEBMAP_AUTO_IMPORT_ON_START=false` e importe pela UI |
| `sh: next: not found` / crash loop no web | App Nixpacks ainda em `next start`. Redeploy com `npm start` (resolve standalone) **ou** use Compose/`frontend/Dockerfile` |
| `Cannot find module '.../.next/standalone/server.js'` | Start fixo apontando para path errado (ex.: Dockerfile com CMD Nixpacks). Use `npm start` / `node start-standalone.mjs`. Preferir o serviço **web** do Compose. |

### Variáveis que derrubam a API se erradas/ausentes

| Variável | Efeito se ausente/inválida |
|----------|----------------------------|
| `JWT_SECRET` | **Crash no boot** (entrypoint ou Nest). Obrigatória ≥32 chars. |
| `POSTGRES_PASSWORD` | Migrate/DB falha → container reinicia → unhealthy |
| `DATABASE_URL` | Montada pelo compose; se mudar `POSTGRES_*` após 1º deploy, DB rejeita auth |
| `STORAGE_LOCAL_DIR` | Em Coolify deve ser `/data/gestop-evidencias` (volume). Ausente → crash de env. |
| `INITIAL_ADMIN_PASSWORD` | Não derruba mais; seed usa fallback. **Defina mesmo assim.** |
| `STORAGE_PUBLIC_URL_BASE` | Em Coolify não derruba se houver URL pública ou fallback; links de foto podem ficar errados até configurar. |

### Se mudou `POSTGRES_PASSWORD` depois do 1º deploy

O Postgres **ignora** a nova senha (dados no volume). Volte à senha original **ou** apague o volume `pgdata` (apaga dados) e redeploy com senha nova + `INITIAL_ADMIN_PASSWORD`.

---

## Alternativa: dois apps Coolify

Só se precisar escalar api/web separados:

1. App **api**: Dockerfile na raiz + Postgres (ou DB gerenciado) + volume `/data`
2. App **web**: `frontend/Dockerfile` (**Dockerfile**, não Nixpacks) + `BACKEND_INTERNAL_URL` apontando para a URL interna/pública da api  
   - CMD esperado: `node start-standalone.mjs` (resolve `./server.js` após COPY do standalone)  
   - Se o painel mostrar `npm start` / `next start` / `node .next/standalone/server.js` com builder Dockerfile, o start command customizado está errado → limpe o override ou use Nixpacks abaixo

**Atenção — dois recursos Coolify:** se ainda existir um app Nixpacks separado (crashando) **e** o Compose, aponte o domínio só para o serviço **web** do Compose e pause/remova o app Nixpacks duplicado.

### Se o web for app Nixpacks (root = `frontend/`)

Não use `next start` — em produção o binário `next` pode sumir do PATH (`sh: next: not found`).
Não use path fixo `node .next/standalone/server.js` se o builder for Dockerfile (lá o arquivo fica em `/app/server.js`).

O build gera `.next/standalone` (`output: 'standalone'`) e o start é:

```bash
npm start
```

(`scripts/start-standalone.mjs` resolve `server.js` em Docker flat, Nixpacks ou path aninhado.)

Arquivos: `frontend/nixpacks.toml`, `frontend/railway.toml`, `frontend/package.json`.

Defina `HOSTNAME=0.0.0.0` e `BACKEND_INTERNAL_URL` (URL da api).

O **compose único** acima é o recomendado (igual SIGLM).
