-- 305: exclusão lógica de vistorias realizadas. Migração ADITIVA: novo valor de enum e colunas NULL.
-- Nenhuma linha é alterada ou apagada.

-- AlterEnum
ALTER TYPE "FiscalizacaoStatus" ADD VALUE IF NOT EXISTS 'EXCLUIDA';

-- AlterTable
ALTER TABLE "Fiscalizacao" ADD COLUMN "excluidoEm" TIMESTAMP(3),
ADD COLUMN "excluidoPorId" TEXT,
ADD COLUMN "exclusaoMotivo" TEXT,
ADD COLUMN "statusAntesExclusao" "FiscalizacaoStatus";

-- CreateIndex
CREATE INDEX "Fiscalizacao_excluidoEm_idx" ON "Fiscalizacao"("excluidoEm");

-- AddForeignKey
ALTER TABLE "Fiscalizacao" ADD CONSTRAINT "Fiscalizacao_excluidoPorId_fkey" FOREIGN KEY ("excluidoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
