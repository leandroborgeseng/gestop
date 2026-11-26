-- 285 fase 1: exceção do Administrador do Sistema por flag (não por nome do perfil).
-- Só aditiva e idempotente. Não apaga, não trunca e não altera linhas existentes.
-- O perfil de sistema recebe administradorSistema = true no seed e no sync-rbac.
ALTER TABLE "Perfil" ADD COLUMN IF NOT EXISTS "administradorSistema" BOOLEAN NOT NULL DEFAULT false;
