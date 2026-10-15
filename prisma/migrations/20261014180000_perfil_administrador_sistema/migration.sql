-- 285 fase 1: exceção do Administrador do Sistema por flag (não por nome do perfil).
-- Aditiva e idempotente: só adiciona a coluna e marca o perfil de sistema existente.
ALTER TABLE "Perfil" ADD COLUMN IF NOT EXISTS "administradorSistema" BOOLEAN NOT NULL DEFAULT false;
UPDATE "Perfil" SET "administradorSistema" = true WHERE "nome" = 'Administrador do Sistema' AND "sistema" = true;
