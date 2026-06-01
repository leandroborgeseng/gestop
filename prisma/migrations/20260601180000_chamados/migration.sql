-- CreateEnum
CREATE TYPE "ChamadoStatus" AS ENUM ('ABERTO', 'EM_TRIAGEM', 'ENCAMINHADO_OS', 'ENCERRADO', 'CANCELADO');
CREATE TYPE "ChamadoOrigem" AS ENUM ('MANUAL', 'QR_CODE', 'INTERNO');

-- AlterEnum
ALTER TYPE "OrdemServicoOrigem" ADD VALUE 'CHAMADO';

-- CreateTable
CREATE TABLE "Chamado" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "secretariaId" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "status" "ChamadoStatus" NOT NULL DEFAULT 'ABERTO',
    "origem" "ChamadoOrigem" NOT NULL DEFAULT 'MANUAL',
    "prioridade" "OrdemServicoPrioridade" NOT NULL DEFAULT 'MEDIA',
    "solicitanteNome" TEXT,
    "solicitanteEmail" TEXT,
    "solicitanteTelefone" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "ordemServicoId" TEXT,
    "registradoPorId" TEXT,
    "encerradoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chamado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Chamado_codigo_key" ON "Chamado"("codigo");
CREATE UNIQUE INDEX "Chamado_ordemServicoId_key" ON "Chamado"("ordemServicoId");
CREATE INDEX "Chamado_secretariaId_idx" ON "Chamado"("secretariaId");
CREATE INDEX "Chamado_unidadeId_idx" ON "Chamado"("unidadeId");
CREATE INDEX "Chamado_status_idx" ON "Chamado"("status");
CREATE INDEX "Chamado_origem_idx" ON "Chamado"("origem");
CREATE INDEX "Chamado_createdAt_idx" ON "Chamado"("createdAt");

-- AddForeignKey
ALTER TABLE "Chamado" ADD CONSTRAINT "Chamado_secretariaId_fkey" FOREIGN KEY ("secretariaId") REFERENCES "Secretaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Chamado" ADD CONSTRAINT "Chamado_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "UnidadePublica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Chamado" ADD CONSTRAINT "Chamado_ordemServicoId_fkey" FOREIGN KEY ("ordemServicoId") REFERENCES "OrdemServico"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Chamado" ADD CONSTRAINT "Chamado_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
