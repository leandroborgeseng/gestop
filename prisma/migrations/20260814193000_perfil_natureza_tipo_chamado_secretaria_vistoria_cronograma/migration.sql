-- CreateEnum
CREATE TYPE "PerfilNatureza" AS ENUM ('INTERNO', 'EXTERNO');

-- AlterTable
ALTER TABLE "Perfil" ADD COLUMN "natureza" "PerfilNatureza" NOT NULL DEFAULT 'INTERNO';

-- CreateTable
CREATE TABLE "TipoChamadoSecretaria" (
    "tipoChamadoId" TEXT NOT NULL,
    "secretariaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TipoChamadoSecretaria_pkey" PRIMARY KEY ("tipoChamadoId","secretariaId")
);

-- AlterTable
ALTER TABLE "Fiscalizacao" ADD COLUMN "cronogramaId" TEXT;
ALTER TABLE "Fiscalizacao" ADD COLUMN "dataProgramada" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "TipoChamadoSecretaria_secretariaId_idx" ON "TipoChamadoSecretaria"("secretariaId");

-- CreateIndex
CREATE INDEX "Fiscalizacao_cronogramaId_idx" ON "Fiscalizacao"("cronogramaId");

-- AddForeignKey
ALTER TABLE "TipoChamadoSecretaria" ADD CONSTRAINT "TipoChamadoSecretaria_tipoChamadoId_fkey" FOREIGN KEY ("tipoChamadoId") REFERENCES "TipoChamado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TipoChamadoSecretaria" ADD CONSTRAINT "TipoChamadoSecretaria_secretariaId_fkey" FOREIGN KEY ("secretariaId") REFERENCES "Secretaria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fiscalizacao" ADD CONSTRAINT "Fiscalizacao_cronogramaId_fkey" FOREIGN KEY ("cronogramaId") REFERENCES "CronogramaChecagem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
