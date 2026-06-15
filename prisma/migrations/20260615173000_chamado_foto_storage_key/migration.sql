-- Persistir chave de storage da foto do chamado (URL e resolvida em runtime)
ALTER TABLE "Chamado" ADD COLUMN IF NOT EXISTS "fotoStorageKey" TEXT;

UPDATE "Chamado"
SET "fotoStorageKey" = regexp_replace("fotoUrl", '^.*/storage/', '')
WHERE "fotoUrl" IS NOT NULL
  AND "fotoUrl" LIKE '%/storage/%'
  AND ("fotoStorageKey" IS NULL OR "fotoStorageKey" = '');

CREATE INDEX IF NOT EXISTS "Chamado_fotoStorageKey_idx" ON "Chamado"("fotoStorageKey");
