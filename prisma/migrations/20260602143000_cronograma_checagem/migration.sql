-- CreateEnum
CREATE TYPE "CronogramaFrequencia" AS ENUM ('SEMANAL', 'QUINZENAL', 'MENSAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL');

-- CreateTable
CREATE TABLE "CronogramaChecagem" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "frequencia" "CronogramaFrequencia" NOT NULL,
    "proximaChecagemEm" TIMESTAMP(3) NOT NULL,
    "ultimaChecagemEm" TIMESTAMP(3),
    "responsavelId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CronogramaChecagem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CronogramaChecagem_unidadeId_checklistId_key" ON "CronogramaChecagem"("unidadeId", "checklistId");

-- CreateIndex
CREATE INDEX "CronogramaChecagem_proximaChecagemEm_idx" ON "CronogramaChecagem"("proximaChecagemEm");

-- CreateIndex
CREATE INDEX "CronogramaChecagem_ativo_idx" ON "CronogramaChecagem"("ativo");

-- CreateIndex
CREATE INDEX "CronogramaChecagem_checklistId_idx" ON "CronogramaChecagem"("checklistId");

-- AddForeignKey
ALTER TABLE "CronogramaChecagem" ADD CONSTRAINT "CronogramaChecagem_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "UnidadePublica"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CronogramaChecagem" ADD CONSTRAINT "CronogramaChecagem_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "Checklist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CronogramaChecagem" ADD CONSTRAINT "CronogramaChecagem_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
