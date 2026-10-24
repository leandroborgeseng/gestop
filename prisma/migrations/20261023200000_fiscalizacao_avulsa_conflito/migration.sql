-- 304/O6a: vistoria enviada como avulsa por conflito de programação. Migração ADITIVA (só colunas/índices/FK novas).
ALTER TABLE "Fiscalizacao" ADD COLUMN "avulsaPorConflito" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Fiscalizacao" ADD COLUMN "avulsaMotivo" TEXT;
ALTER TABLE "Fiscalizacao" ADD COLUMN "conflitoCronogramaId" TEXT;
ALTER TABLE "Fiscalizacao" ADD COLUMN "conflitoDataProgramada" TIMESTAMP(3);
ALTER TABLE "Fiscalizacao" ADD COLUMN "conflitoCodigo" TEXT;
CREATE INDEX "Fiscalizacao_avulsaPorConflito_idx" ON "Fiscalizacao"("avulsaPorConflito");
CREATE INDEX "Fiscalizacao_conflitoCronogramaId_idx" ON "Fiscalizacao"("conflitoCronogramaId");
ALTER TABLE "Fiscalizacao" ADD CONSTRAINT "Fiscalizacao_conflitoCronogramaId_fkey" FOREIGN KEY ("conflitoCronogramaId") REFERENCES "CronogramaChecagem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
