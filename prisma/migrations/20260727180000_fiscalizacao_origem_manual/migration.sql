-- AlterEnum: origem de vistoria lançada manualmente (papel / desk)
ALTER TYPE "FiscalizacaoOrigem" ADD VALUE IF NOT EXISTS 'MANUAL';

-- Data real da vistoria informada no lançamento manual
ALTER TABLE "Fiscalizacao" ADD COLUMN IF NOT EXISTS "dataVistoriaInformada" TIMESTAMP(3);

-- Metadados de auditoria do lançamento (JSON)
ALTER TABLE "Fiscalizacao" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- Índice por origem (consultas / filtros)
CREATE INDEX IF NOT EXISTS "Fiscalizacao_origem_idx" ON "Fiscalizacao"("origem");
