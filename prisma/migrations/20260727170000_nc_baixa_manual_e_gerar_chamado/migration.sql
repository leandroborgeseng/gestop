-- AlterEnum: baixa manual de NC
ALTER TYPE "NaoConformidadeStatus" ADD VALUE IF NOT EXISTS 'BAIXADA_MANUAL';

-- AlterTable: auditoria de baixa manual
ALTER TABLE "NaoConformidade" ADD COLUMN IF NOT EXISTS "motivoBaixa" TEXT,
ADD COLUMN IF NOT EXISTS "baixadaEm" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "baixadaPorId" TEXT;

CREATE INDEX IF NOT EXISTS "NaoConformidade_baixadaPorId_idx" ON "NaoConformidade"("baixadaPorId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NaoConformidade_baixadaPorId_fkey'
  ) THEN
    ALTER TABLE "NaoConformidade"
      ADD CONSTRAINT "NaoConformidade_baixadaPorId_fkey"
      FOREIGN KEY ("baixadaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
