# Importação do webmap QGIS (SMMAFRANCA/webmap)

Importa **Próprio Público Municipal**, **Unidades Escolares** e **Imóvel Público (120)** do repositório [SMMAFRANCA/webmap](https://github.com/SMMAFRANCA/webmap) para `UnidadePublica` no GestOP.

## Pré-requisitos

1. Secretarias cadastradas (`npm run import:secretarias data/secretarias.template.csv`)
2. `DATABASE_URL` configurada
3. Acesso à internet (download das camadas `.js` no GitHub) **ou** clone local do webmap

## Importação completa (CLI / Railway one-off)

```bash
# Secretarias + 38 camadas webmap (proprios, escolas, imoveis publicos)
npm run import:all-test-data:dry-run
npm run import:all-test-data
```

## Painel web (Admin → Importação)

Após login como admin, abra **Administração → Importação** e use **Importar do GitHub agora**. O sistema:

1. Consulta o último commit em [SMMAFRANCA/webmap](https://github.com/SMMAFRANCA/webmap)
2. Baixa as 38 camadas configuradas
3. Faz upsert no banco por `codigoPatrimonial`
4. Registra a sync na auditoria (commit SHA)

Se o commit no GitHub for diferente do último importado, aparece alerta **Há alterações no GitHub**.

## Comandos granulares

```bash
# Simular (lista unidades sem gravar)
npm run import:webmap:dry-run

# Importar / atualizar (upsert por codigo_patrimonial)
npm run import:webmap

# Usar clone local do repositório webmap
git clone https://github.com/SMMAFRANCA/webmap.git /tmp/webmap
npm run import:webmap:dry-run -- --local=/tmp/webmap/layers
npm run import:webmap -- --local=/tmp/webmap/layers
```

## Camadas incluídas (38)

| Grupo | Camadas | Secretaria padrão |
|-------|---------|-------------------|
| Próprio Público Municipal | 24 | SMS, SME, SMEL, SSMA, SMCT, SMF |
| Unidades Escolares | 13 | SME |
| Imóvel Público | 1 (`ImvelPblico120unid_86.js`) | SSMA |

## Mapeamento

| Webmap | GestOP |
|--------|--------|
| `cadastro_imobiliario` | `codigoPatrimonial` → `PMF-{digits}` |
| Sem cadastro | `PMF-WEBMAP-{camada}-{fid}` |
| `unidade_escolar` / `EQUIPAMENTO_DE_SAÚDE` / `proprio_municipal` | `nome` |
| Geometria Point / `lat`+`long` | `latitude`, `longitude` |
| Demais atributos | `metadata.webmapProperties` |

## Variáveis opcionais

```env
WEBMAP_RAW_BASE=https://raw.githubusercontent.com/SMMAFRANCA/webmap/main/layers
```

## Reimportar / sincronizar

O script é **idempotente**: roda de novo após atualização do webmap no GitHub. Registros com mesmo `codigoPatrimonial` são atualizados.

## Produção (Railway)

Os dados importados ficam **persistidos no PostgreSQL** do Railway. Novos deploys **não apagam** as unidades já importadas.

No boot do backend (`startup.js`), após migrate + seed:

1. Se já existir importação registrada **e** houver pelo menos 10 unidades ativas → **nada é reimportado**
2. Se o banco estiver vazio ou só com as 3 unidades do seed → importação automática do GitHub (secretarias + 38 camadas)

Variáveis opcionais:

```env
WEBMAP_AUTO_IMPORT_ON_START=true   # false para desativar
WEBMAP_AUTO_IMPORT_MIN_UNITS=10    # limiar mínimo de unidades ativas
```

Para atualizar quando o webmap mudar no GitHub, use **Admin → Importação** ou configure cron/webhook (ver painel).

Importação manual one-off (se necessário):

```bash
npm run import:webmap:dry-run
npm run import:webmap
```

Depois: `npm run go-live:check` e validar mapa em `/cco`.
