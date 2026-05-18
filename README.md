# GestOP

Backend inicial da plataforma de gestao de ordens de servico e fiscalizacao georreferenciada da Prefeitura de Franca.

## Stack

- NestJS + TypeScript
- Prisma 7
- PostgreSQL + PostGIS
- Vitest
- Docker Compose para banco local

## Ambiente Local

```bash
npm install
docker compose up -d postgres
npm run prisma:deploy
npm run prisma:seed
npm run build
npm test
npm run dev
```

A API inicia por padrao em `http://localhost:3001`.

Para o frontend:

```bash
cd frontend
npm install
npm run dev
```

O app Next.js inicia por padrao em `http://localhost:3000`.

## Rotas da Fase 2

API:

- `GET /operacional/resumo`
- `GET /operacional/secretarias`
- `GET /operacional/bairros`
- `GET /operacional/unidades`
- `GET /operacional/unidades/:id`
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/logout`
- `GET/POST /admin/secretarias`
- `PUT/DELETE /admin/secretarias/:id`
- `GET/POST /admin/unidades`
- `PUT/DELETE /admin/unidades/:id`
- `GET/POST /admin/usuarios`
- `PUT/DELETE /admin/usuarios/:id`
- `GET /admin/perfis`
- `GET/POST /checklists`
- `GET/PUT/DELETE /checklists/:id`
- `POST /checklists/:id/versions`
- `PUT /checklists/versions/:versionId`
- `POST /checklists/versions/:versionId/publish`
- `GET /mobile/field-package`
- `POST /mobile/sync/fiscalizacoes`

Frontend:

- `/login`: entrada com usuários seed.
- `/cco`: mapa CCO, indicadores, filtros e listagem de proprios.
- `/cco/unidades/[id]`: detalhe operacional do proprio publico.
- `/admin`: administracao de secretarias, proprios publicos e usuarios.
- `/checklists`: construtor de checklists, versões e publicação.
- `/mobile`: PWA de campo para execução offline de fiscalizações.

## Usuarios Seed

Todos os usuarios seed usam a senha `Gestop@123`.

| Perfil | E-mail | Permissoes principais |
| --- | --- | --- |
| Administrador do Sistema | `admin.gestop@franca.sp.gov.br` | Todas |
| Gestor CCO | `carla.mendes@franca.sp.gov.br` | CCO, cadastros, checklists, OS, auditoria |
| Agente de Campo | `joao.pereira@franca.sp.gov.br` | Execucao de fiscalizacoes |
| Operador de Manutencao | `lucas.almeida@franca.sp.gov.br` | Gestao de chamados/OS |

## Arquivos Principais

- `prisma/schema.prisma`: modelo logico Prisma.
- `prisma/migrations/20260518141000_init/migration.sql`: migracao inicial com tabelas, enums, indices e PostGIS.
- `prisma/seed.ts`: dados realistas para desenvolvimento.
- `src/domain`: regras puras de geolocalizacao, evidencias e versionamento.
- `src/operacional`: consultas da CCO e mapeamento operacional de proprios.
- `frontend/app/cco`: jornada de leitura operacional em Next.js.
- `docs/modelo-dados.md`: diagrama textual e decisoes de modelagem.
