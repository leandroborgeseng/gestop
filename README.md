# SIGMA

**Sistema Integrado de Gestão de Manutenção de Ativos** — plataforma de gestão operacional, ordens de serviço e fiscalização georreferenciada da Prefeitura de Franca.

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

## App de vistoria em campo (303/304)

Variáveis de ambiente opcionais da API (sem migração; valem para o pacote offline e para o sync):

| Variável | Padrão | O que faz |
| --- | --- | --- |
| `MOBILE_CHECKIN_PRECISAO_MAX_METROS` | `50` (m) | Precisão máxima aceita no check-in GPS (D2). Acima disso o app pede para tentar de novo e a API recusa o sync. Aceita valores maiores que 0, até 1000. |
| `MOBILE_PACOTE_VALIDADE_DIAS` | `7` (dias) | Validade do pacote offline (D3). Depois disso o app avisa que o pacote venceu, mas continua funcionando e não perde dados. Aceita valores maiores que 0, até 365. |

Valor ausente ou inválido usa o padrão. O pacote offline informa ao app os valores em uso (`config.precisaoMaxCheckinMetros`, `validadeDias` e `validoAte`).

**Envio como avulsa por conflito (O6a).** Quando o sync de uma vistoria programada dá conflito (409), o agente pode tocar em "Enviar como vistoria avulsa" e informar um motivo, que é obrigatório. O que acontece:

- A vistoria é gravada com `avulsaPorConflito = true`, o motivo e a referência da programação (`conflitoCronogramaId`, `conflitoDataProgramada` e `conflitoCodigo`).
- A programação **não** é baixada e continua sinalizada (`conflitoAvulsa`) até receber uma baixa real.
- Fica registrada uma auditoria com quem enviou, quando e o motivo.
- O gestor filtra essas vistorias em `GET /fiscalizacoes?avulsaPorConflito=true` ou no filtro "Avulsa por conflito" da tela de Vistorias.

## Deploy Coolify

Stack completa (PostGIS + API + Web) no mesmo padrao dos outros apps deste ambiente:

- Compose: [`docker-compose.coolify.yml`](docker-compose.coolify.yml)
- Guia: [`COOLIFY.md`](COOLIFY.md)
- Variaveis: [`.env.coolify.example`](.env.coolify.example)

```bash
cp .env.coolify.example .env
# edite POSTGRES_PASSWORD, JWT_SECRET, INITIAL_ADMIN_PASSWORD
docker compose -f docker-compose.coolify.yml up -d --build
```

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
- `GET /ordens-servico`
- `GET /ordens-servico/:id`
- `PUT /ordens-servico/:id`
- `POST /ordens-servico/gerar/nao-conformidades/:id`
- `GET /monitoramento/dashboard`
- `GET /monitoramento/auditoria`
- `GET /integracoes/eventos`
- `POST /integracoes/notificar`
- `POST /integracoes/sync/retry`

Frontend:

- `/login`: entrada com usuários seed.
- `/cco`: mapa CCO, indicadores, filtros e listagem de proprios.
- `/cco/unidades/[id]`: detalhe operacional do proprio publico.
- `/admin`: administracao de secretarias, proprios publicos e usuarios.
- `/checklists`: construtor de checklists, versões e publicação.
- `/mobile`: PWA de campo para execução offline de fiscalizações.
- `/ordens-servico`: visualização de OS geradas e origem.
- `/dashboard`: indicadores operacionais e auditoria.
- `/integracoes`: eventos técnicos, notificações mock e retentativa de sync.

## Usuarios Seed

Todos os usuarios seed usam a senha `Gestop@123`.

| Perfil | E-mail | Permissoes principais |
| --- | --- | --- |
| Administrador do Sistema | `admin.gestop@franca.sp.gov.br` | Todas |
| Gestor CCO | `carla.mendes@franca.sp.gov.br` | CCO, checklists, OS, auditoria |
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
- `docs/publicacao-github-railway.md`: publicacao no GitHub e deploy no Railway.
