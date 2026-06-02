# Fase 4 — Go-live operacional

## Implementado

### Chamados + QR Code
- Modelo `Chamado` com status, origem (QR_CODE, INTERNO, MANUAL) e conversão para OS
- API autenticada (`chamados.gerenciar`):
  - `GET /chamados`
  - `GET /chamados/:id`
  - `POST /chamados`
  - `PUT /chamados/:id/status`
  - `POST /chamados/:id/converter-os`
- API pública (rate limit):
  - `GET /public/unidades/:codigo` — dados do próprio para QR
  - `POST /public/unidades/:codigo/chamados` — abertura de chamado cidadão
- Frontend:
  - `/chamado/[codigo]` — formulário público (QR Code aponta para `https://FRONTEND/chamado/PMF-ESC-001`)
  - `/chamados` — triagem CCO (filtros, status, converter em OS)

### Import de secretarias
```bash
npm run import:secretarias:dry-run data/secretarias.template.csv
npm run import:secretarias data/secretarias.template.csv
```

CSV: `sigla,nome,responsavel_nome,responsavel_email,ativo` — 9 secretarias de Franca.

### Homologação go-live
```bash
npm run go-live:check
```

Verifica JWT, storage, URL pública, contagens de secretarias/unidades/usuários.

### Health
`GET /health/db` inclui contagem de unidades e chamados.

### Migration
- `20260601180000_chamados`

## QR Code por unidade

URL sugerida para impressão nos próprios:
```
https://SEU-FRONTEND.up.railway.app/chamado/PMF-ESC-001
```

Substitua `PMF-ESC-001` pelo `codigo_patrimonial` de cada unidade.

## Sequência recomendada antes do go-live

1. Deploy backend + frontend no Railway (ver `docs/publicacao-github-railway.md`)
2. Rodar migrations e seed admin
3. Importar secretarias: `npm run import:secretarias data/secretarias.template.csv`
4. Importar unidades oficiais (~165): `npm run import:unidades data/unidades-franca.csv`  
   **Ou** importar do webmap QGIS: `npm run import:webmap` (ver `docs/import-webmap.md`)
5. Rodar `npm run go-live:check`
6. Homologar piloto: QR → chamado → triagem → OS → conclusão
7. Treinar operadores CCO e equipes de campo

## Próximo (pós go-live)

- Monitoramento (Sentry) e backup Postgres documentado
- Push notifications mobile (Web Push / webhook)
- Relatórios exportáveis PDF (além do CSV já disponível)
- PWA instalável para campo (implementado na Fase 5)

**Fora do escopo:** BI externo e app nativo — plataforma 100% web/PWA.
