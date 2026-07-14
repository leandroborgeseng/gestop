-- Perfis/secretarias ativos na sessão + permissões individuais e multi-secretaria.

ALTER TABLE "Usuario"
  ADD COLUMN IF NOT EXISTS "perfilAtivoId" TEXT,
  ADD COLUMN IF NOT EXISTS "secretariaAtivaId" TEXT,
  ADD COLUMN IF NOT EXISTS "acessoTodasSecretarias" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "UsuarioPermissao" (
  "usuarioId" TEXT NOT NULL,
  "permissaoId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UsuarioPermissao_pkey" PRIMARY KEY ("usuarioId", "permissaoId")
);

CREATE TABLE IF NOT EXISTS "UsuarioSecretaria" (
  "usuarioId" TEXT NOT NULL,
  "secretariaId" TEXT NOT NULL,
  "principal" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UsuarioSecretaria_pkey" PRIMARY KEY ("usuarioId", "secretariaId")
);

CREATE INDEX IF NOT EXISTS "Usuario_perfilAtivoId_idx" ON "Usuario"("perfilAtivoId");
CREATE INDEX IF NOT EXISTS "Usuario_secretariaAtivaId_idx" ON "Usuario"("secretariaAtivaId");
CREATE INDEX IF NOT EXISTS "UsuarioSecretaria_secretariaId_idx" ON "UsuarioSecretaria"("secretariaId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Usuario_perfilAtivoId_fkey'
  ) THEN
    ALTER TABLE "Usuario"
      ADD CONSTRAINT "Usuario_perfilAtivoId_fkey"
      FOREIGN KEY ("perfilAtivoId") REFERENCES "Perfil"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Usuario_secretariaAtivaId_fkey'
  ) THEN
    ALTER TABLE "Usuario"
      ADD CONSTRAINT "Usuario_secretariaAtivaId_fkey"
      FOREIGN KEY ("secretariaAtivaId") REFERENCES "Secretaria"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UsuarioPermissao_usuarioId_fkey'
  ) THEN
    ALTER TABLE "UsuarioPermissao"
      ADD CONSTRAINT "UsuarioPermissao_usuarioId_fkey"
      FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UsuarioPermissao_permissaoId_fkey'
  ) THEN
    ALTER TABLE "UsuarioPermissao"
      ADD CONSTRAINT "UsuarioPermissao_permissaoId_fkey"
      FOREIGN KEY ("permissaoId") REFERENCES "Permissao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UsuarioSecretaria_usuarioId_fkey'
  ) THEN
    ALTER TABLE "UsuarioSecretaria"
      ADD CONSTRAINT "UsuarioSecretaria_usuarioId_fkey"
      FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UsuarioSecretaria_secretariaId_fkey'
  ) THEN
    ALTER TABLE "UsuarioSecretaria"
      ADD CONSTRAINT "UsuarioSecretaria_secretariaId_fkey"
      FOREIGN KEY ("secretariaId") REFERENCES "Secretaria"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Migra secretaria principal atual para vínculos e define secretaria/perfil ativos iniciais.
INSERT INTO "UsuarioSecretaria" ("usuarioId", "secretariaId", "principal", "createdAt")
SELECT u."id", u."secretariaId", true, CURRENT_TIMESTAMP
FROM "Usuario" u
WHERE u."secretariaId" IS NOT NULL
ON CONFLICT ("usuarioId", "secretariaId") DO NOTHING;

UPDATE "Usuario" u
SET "secretariaAtivaId" = COALESCE(u."secretariaAtivaId", u."secretariaId")
WHERE u."secretariaId" IS NOT NULL;

UPDATE "Usuario" u
SET "perfilAtivoId" = sub."perfilId"
FROM (
  SELECT DISTINCT ON (up."usuarioId") up."usuarioId", up."perfilId"
  FROM "UsuarioPerfil" up
  JOIN "Perfil" p ON p."id" = up."perfilId"
  WHERE p."ativo" = true
  ORDER BY up."usuarioId", up."createdAt" ASC
) AS sub
WHERE u."id" = sub."usuarioId"
  AND u."perfilAtivoId" IS NULL;
