-- CreateIndex
CREATE INDEX "Chamado_previstaExecucaoEm_idx" ON "Chamado"("previstaExecucaoEm");

-- CreateIndex
CREATE INDEX "Chamado_status_equipeId_idx" ON "Chamado"("status", "equipeId");

-- CreateIndex
CREATE INDEX "Chamado_status_previstaExecucaoEm_idx" ON "Chamado"("status", "previstaExecucaoEm");
