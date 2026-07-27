#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "ERRO: DATABASE_URL nao definida (servico api)."
  echo "No compose Coolify a URL e montada automaticamente a partir de POSTGRES_*."
  exit 1
fi

case "$JWT_SECRET" in
  ''|'change_me_jwt_secret'|'troque-este-segredo-em-producao'*|'Defina JWT_SECRET'*)
    echo "AVISO: JWT_SECRET fraco ou placeholder — defina no Coolify (openssl rand -base64 48)."
    ;;
esac

case "$POSTGRES_PASSWORD" in
  ''|'gestop_change_me'|'gestop'|'Defina POSTGRES_PASSWORD'*)
    echo "AVISO: POSTGRES_PASSWORD fraca ou placeholder — use senha real no Coolify."
    ;;
esac

# Alias Coolify (mesmo padrao SIGLM): RUN_SEED=true forca seed mesmo com usuarios
if [ "$RUN_SEED" = "true" ]; then
  export FORCE_SEED_ON_START=true
  echo "RUN_SEED=true → FORCE_SEED_ON_START=true"
fi

if [ -z "$INITIAL_ADMIN_PASSWORD" ] && [ "$FORCE_SEED_ON_START" = "true" ]; then
  echo "AVISO: INITIAL_ADMIN_PASSWORD vazia — obrigatoria no primeiro seed de producao."
fi

echo "Iniciando SIGMA API (migrate + seed via npm start)..."
exec npm start
