-- Checklist finalidade (vistoria vs execução de chamado) + vínculo com tipos de chamado

CREATE TYPE "ChecklistFinalidade" AS ENUM ('VISTORIA', 'CHAMADO');

ALTER TABLE "Checklist"
  ADD COLUMN "finalidade" "ChecklistFinalidade" NOT NULL DEFAULT 'VISTORIA';

CREATE INDEX "Checklist_finalidade_idx" ON "Checklist"("finalidade");

CREATE TABLE "ChecklistTipoChamado" (
  "checklistId" TEXT NOT NULL,
  "tipoChamadoId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ChecklistTipoChamado_pkey" PRIMARY KEY ("checklistId", "tipoChamadoId")
);

CREATE INDEX "ChecklistTipoChamado_tipoChamadoId_idx" ON "ChecklistTipoChamado"("tipoChamadoId");

ALTER TABLE "ChecklistTipoChamado"
  ADD CONSTRAINT "ChecklistTipoChamado_checklistId_fkey"
  FOREIGN KEY ("checklistId") REFERENCES "Checklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChecklistTipoChamado"
  ADD CONSTRAINT "ChecklistTipoChamado_tipoChamadoId_fkey"
  FOREIGN KEY ("tipoChamadoId") REFERENCES "TipoChamado"("id") ON DELETE CASCADE ON UPDATE CASCADE;
