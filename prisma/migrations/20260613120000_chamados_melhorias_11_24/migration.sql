-- Equipe: tipo e e-mail
CREATE TYPE "EquipeTipo" AS ENUM ('PROPRIA', 'TERCEIRIZADA');

ALTER TABLE "Equipe" ADD COLUMN "tipo" "EquipeTipo" NOT NULL DEFAULT 'PROPRIA';
ALTER TABLE "Equipe" ADD COLUMN "emailEquipe" TEXT;

-- Tipos de chamado com SLA por prioridade
CREATE TABLE "TipoChamado" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "slaBaixaDias" INTEGER NOT NULL DEFAULT 30,
    "slaMediaDias" INTEGER NOT NULL DEFAULT 15,
    "slaAltaDias" INTEGER NOT NULL DEFAULT 7,
    "slaUrgenteDias" INTEGER NOT NULL DEFAULT 3,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TipoChamado_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TipoChamado_nome_key" ON "TipoChamado"("nome");
CREATE INDEX "TipoChamado_ativo_idx" ON "TipoChamado"("ativo");

ALTER TABLE "Chamado" ADD COLUMN "tipoChamadoId" TEXT;

ALTER TABLE "Chamado" ADD CONSTRAINT "Chamado_tipoChamadoId_fkey"
    FOREIGN KEY ("tipoChamadoId") REFERENCES "TipoChamado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Chamado_tipoChamadoId_idx" ON "Chamado"("tipoChamadoId");
