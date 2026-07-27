#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "ERRO: DATABASE_URL nao definida (servico api)."
  echo "No compose Coolify a URL e montada automaticamente a partir de POSTGRES_*."
  exit 1
fi

# JWT: falha cedo com mensagem clara (evita migrate+seed e so depois crash no Nest)
jwt_len=$(printf '%s' "$JWT_SECRET" | wc -c | tr -d ' ')
case "$JWT_SECRET" in
  ''|'change_me_jwt_secret'|'troque-este-segredo-em-producao'*|'Defina JWT_SECRET'*|'change-me'|'gestop-dev-secret-change-me')
    echo "ERRO: JWT_SECRET ausente, fraco ou placeholder."
    echo "No Coolify (Environment), defina JWT_SECRET como Build Variable:"
    echo "  openssl rand -base64 48"
    echo "Minimo: 32 caracteres aleatorios. Redeploy apos salvar."
    exit 1
    ;;
esac
if [ "$jwt_len" -lt 32 ]; then
  echo "ERRO: JWT_SECRET tem $jwt_len caracteres (minimo 32)."
  echo "Gere com: openssl rand -base64 48"
  exit 1
fi

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

if [ -z "$INITIAL_ADMIN_PASSWORD" ]; then
  echo "AVISO: INITIAL_ADMIN_PASSWORD vazia."
  echo "No 1o deploy (banco vazio) o seed usara fallback temporario Gestop@123 — troque depois."
  echo "Defina INITIAL_ADMIN_PASSWORD (>=12 chars) como Build Variable no Coolify."
fi

# Coolify detectavel mesmo se o painel nao injetar COOLIFY_*
export COOLIFY="${COOLIFY:-true}"

# Bind explicito para healthcheck 127.0.0.1 (compose tambem seta HOST)
export HOST="${HOST:-0.0.0.0}"
export PORT="${PORT:-3001}"

echo "Iniciando SIGMA API (migrate + seed via npm start) em ${HOST}:${PORT}..."
exec npm start
