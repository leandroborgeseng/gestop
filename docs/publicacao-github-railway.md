# GestOP — Guia de publicação no GitHub e deploy (Railway)

> **Para uso em outra conta Cursor:** copie este arquivo para o projeto ou cole no chat como contexto.  
> Ele descreve como publicar o código no GitHub e colocar a aplicação no ar.

---

## 1. Visão geral do projeto

| Item | Valor |
|------|-------|
| Repositório GitHub | `https://github.com/leandroborgeseng/gestop` |
| Branch principal | `main` |
| Backend | NestJS + Prisma + PostgreSQL (pasta raiz) |
| Frontend | Next.js 16 + Tailwind (pasta `frontend/`) |
| Deploy recomendado | **Railway** (3 recursos: Postgres + Backend + Frontend) |

### Estrutura de pastas

```
gestop/
├── src/                    # API NestJS
├── prisma/                 # Schema, migrations, seed, startup
├── frontend/               # App Next.js
│   ├── app/                # Rotas (login, cco, admin, etc.)
│   ├── components/         # UI e layout
│   └── lib/api.ts          # Cliente API (usa /api-gestop)
├── docs/                   # Documentação
├── package.json            # Backend
└── docker-compose.yml        # Postgres local (PostGIS)
```

---

## 2. Pré-requisitos

- Node.js 20+
- Git
- Conta GitHub
- Conta Railway (para deploy em produção)
- Docker (opcional, só para banco local)

---

## 3. Publicar no GitHub

### 3.1 Primeira publicação (repositório novo)

```bash
# Na pasta do projeto
git init
git add .
git commit -m "Publicar GestOP"

# Criar repo vazio no GitHub (ex.: gestop) e conectar:
git remote add origin https://github.com/SEU_USUARIO/gestop.git
git branch -M main
git push -u origin main
```

### 3.2 Atualizar código já publicado

```bash
git status
git add .
git commit -m "Descreva a alteração"
git push origin main
```

### 3.3 O que NÃO commitar

Arquivos ignorados em `.gitignore`:

- `.env`, `.env.local` (segredos)
- `node_modules/`, `dist/`, `.next/`
- `*.log`

**Nunca** commitar `DATABASE_URL`, `JWT_SECRET` ou senhas reais.

---

## 4. Desenvolvimento local

### 4.1 Banco de dados

```bash
docker compose up -d postgres
cp .env.example .env
# Edite .env se necessário
```

`.env` mínimo (raiz do projeto):

```env
DATABASE_URL="postgresql://gestop:gestop@localhost:5432/gestop?schema=public"
PORT=3001
JWT_SECRET="troque-este-segredo-em-producao"
```

### 4.2 Backend

```bash
npm install
npm run prisma:deploy
npm run prisma:seed
npm run build
npm run dev
```

API local: `http://localhost:3001`

### 4.3 Frontend

```bash
cd frontend
npm install
npm run dev
```

App local: `http://localhost:3000`

O frontend chama a API via proxy interno `/api-gestop` (não usar URL externa no browser).

---

## 5. Deploy no Railway (produção)

### 5.1 Arquitetura

Crie **3 serviços** no mesmo projeto Railway:

```
┌─────────────────┐     rede privada      ┌─────────────────┐
│    Frontend     │ ────────────────────► │     Backend     │
│   (Next.js)     │  BACKEND_INTERNAL_URL │    (NestJS)     │
│   porta 3000    │                       │   porta 8080    │
└─────────────────┘                       └────────┬────────┘
                                                     │
                                                     ▼
                                            ┌─────────────────┐
                                            │   PostgreSQL    │
                                            │   (Railway)     │
                                            └─────────────────┘
```

### 5.2 Serviço: PostgreSQL

1. Adicionar plugin **PostgreSQL** no Railway.
2. Copiar a variável `DATABASE_URL` gerada automaticamente.
3. Usar a mesma URL no serviço **Backend**.

### 5.3 Serviço: Backend (NestJS)

| Configuração | Valor |
|--------------|-------|
| **Root Directory** | `/` (raiz do repo) |
| **Build Command** | `npm ci && npm run build` |
| **Start Command** | `npm start` |
| **Porta exposta** | Railway define `PORT` (ex.: 8080) |

`npm start` executa:

```bash
node dist/prisma/startup.js && node dist/src/main.js
```

O `startup.js` faz automaticamente: bootstrap → migrate → seed → sobe a API.

#### Variáveis de ambiente (Backend)

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `DATABASE_URL` | Sim | URL do Postgres Railway |
| `JWT_SECRET` | Sim | Segredo forte para tokens (mín. 32 caracteres) |
| `NODE_ENV` | Sim | `production` |
| `INITIAL_ADMIN_PASSWORD` | Sim* | Senha do admin no **primeiro seed** (*só se banco vazio) |
| `STORAGE_DRIVER` | Sim | `s3` em produção (ou `local` para testes) |
| `S3_BUCKET` | Sim** | Bucket de evidências (**se `STORAGE_DRIVER=s3`) |
| `S3_ACCESS_KEY_ID` | Sim** | Credencial S3/R2 |
| `S3_SECRET_ACCESS_KEY` | Sim** | Credencial S3/R2 |
| `S3_PUBLIC_URL_BASE` | Sim** | URL pública dos arquivos |
| `S3_ENDPOINT` | Não | Endpoint R2/MinIO (se não for AWS) |
| `PORT` | Auto | Railway injeta automaticamente |
| `FORCE_DB_RESET` | Não | `true` só para resetar banco (temporário) |
| `FORCE_SEED_ON_START` | Não | `true` força seed mesmo com dados |

**Importante:** o backend pode ficar **Unexposed** (sem URL pública). O frontend acessa pela rede interna.

### 5.4 Serviço: Frontend (Next.js)

| Configuração | Valor |
|--------------|-------|
| **Root Directory** | `frontend` |
| **Build Command** | `npm ci && npm run build` |
| **Start Command** | `npm start` |
| **Porta** | Railway define `PORT` |

#### Variáveis de ambiente (Frontend)

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `BACKEND_INTERNAL_URL` | Sim | URL interna do backend |
| `NODE_ENV` | Sim | `production` |

**Não definir** `NEXT_PUBLIC_SHOW_DEMO_LOGIN` em produção.

**Exemplo de `BACKEND_INTERNAL_URL`:**

```env
# Opção 1 — referência Railway (recomendado)
BACKEND_INTERNAL_URL=http://${{gestop.RAILWAY_PRIVATE_DOMAIN}}:${{gestop.PORT}}

# Opção 2 — hostname fixo interno
BACKEND_INTERNAL_URL=http://gestop.railway.internal:8080
```

Substitua `gestop` pelo **nome do serviço backend** no Railway.

#### Variáveis que NÃO devem existir no Frontend

```env
# REMOVER se existir — quebra login em produção
NEXT_PUBLIC_API_URL=...
```

O browser sempre usa `/api-gestop`, que é proxy server-side em:

`frontend/app/api-gestop/[...path]/route.ts`

### 5.5 Conectar GitHub ao Railway

1. Railway → **New Project** → **Deploy from GitHub repo**
2. Selecionar `leandroborgeseng/gestop` (ou fork)
3. Criar **dois serviços** a partir do mesmo repo:
   - Serviço 1: raiz → Backend
   - Serviço 2: root `frontend` → Frontend
4. Adicionar PostgreSQL
5. Configurar variáveis conforme seções acima
6. Cada push na branch `main` dispara redeploy automático

---

## 6. Credenciais de acesso (seed)

Após o primeiro deploy com seed:

| Campo | Valor |
|-------|-------|
| E-mail | `admin.gestop@franca.sp.gov.br` |
| Senha | `Gestop@123` |

Outros usuários seed estão em `README.md` e `prisma/seed.ts`.

---

## 7. Verificação pós-deploy

### Backend

```bash
# Se exposto publicamente (opcional):
curl https://SEU-BACKEND.railway.app/health/db
```

Nos logs Railway, procurar:

```
[GestOP:startup] Preparacao do banco concluida
[GestOP:api] Servidor ouvindo na porta ...
[GestOP:startup] Usuarios cadastrados: 4
```

### Frontend

1. Abrir URL pública do frontend Railway
2. Acessar `/login`
3. Entrar com credenciais seed
4. Verificar `/cco` (mapa e listagem)

### Diagnóstico de proxy

```bash
curl https://SEU-FRONTEND.railway.app/api/health/backend
```

Se retornar 502, revisar `BACKEND_INTERNAL_URL`.

---

## 8. Problemas comuns e soluções

| Problema | Causa | Solução |
|----------|-------|---------|
| Login "Load failed" | `NEXT_PUBLIC_API_URL` externa | Remover variável; usar só `/api-gestop` |
| Backend 502 no frontend | `BACKEND_INTERNAL_URL` errada | Usar rede privada Railway |
| `Cannot find module dist/main.js` | Path incorreto | Entry é `dist/src/main.js` |
| `npm ci` falha no frontend | Dependências emnapi | Já estão em `frontend/package.json` |
| Migration P3009 / banco vazio | Migration falhou | `FORCE_DB_RESET=true` uma vez, redeploy |
| Mapa cinza / não aparece | Leaflet sem tamanho | Já corrigido; garantir versão recente |
| Menu não navega | Shell remontando | Usar layout `(authenticated)` |

---

## 9. Comandos úteis

```bash
# Backend
npm run build          # Compilar
npm run dev            # Dev local
npm run prisma:deploy  # Migrations
npm run prisma:seed    # Popular banco
npm test               # Testes

# Frontend
cd frontend
npm run build          # Build produção
npm run dev            # Dev local
npm run lint           # Lint
```

---

## 10. Fluxo recomendado para a IA (Cursor)

Quando pedir para publicar ou fazer deploy:

1. Confirmar que `.env` não será commitado
2. `git status` → `git add` → `git commit` → `git push origin main`
3. Verificar deploy automático no Railway
4. Conferir logs do backend (migrations + seed)
5. Testar login no frontend público
6. Remover variáveis temporárias (`FORCE_DB_RESET`, etc.)

### Prompt sugerido para outra conta Cursor

```
Leia docs/publicacao-github-railway.md deste repositório.
Preciso publicar/atualizar o GestOP no GitHub e validar o deploy no Railway.
Siga o guia passo a passo, não commite segredos, e confirme login em /login após o deploy.
```

---

## 11. Referências no código

| Arquivo | Função |
|---------|--------|
| `frontend/lib/backend-url.ts` | Resolve URL interna do backend |
| `frontend/app/api-gestop/[...path]/route.ts` | Proxy API |
| `frontend/lib/api.ts` | Cliente sempre usa `/api-gestop` |
| `prisma/startup.ts` | Boot: migrate + seed + API |
| `prisma/seed.ts` | Dados iniciais |
| `package.json` (raiz) | Scripts do backend |
| `frontend/package.json` | Scripts do frontend |
| `.env.example` | Variáveis locais |
| `designSystem.md` | Cores e identidade visual |

---

## 12. Checklist rápido de deploy

- [ ] Código no GitHub (`main` atualizada)
- [ ] PostgreSQL criado no Railway
- [ ] Backend: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV=production`
- [ ] Frontend: `BACKEND_INTERNAL_URL` apontando para backend interno
- [ ] Frontend **sem** `NEXT_PUBLIC_API_URL`
- [ ] Root do frontend = `frontend`
- [ ] Logs mostram seed concluído
- [ ] Login funciona em `/login`
- [ ] CCO carrega mapa e unidades em `/cco`

---

*Última atualização: maio/2026 — GestOP Prefeitura de Franca*
