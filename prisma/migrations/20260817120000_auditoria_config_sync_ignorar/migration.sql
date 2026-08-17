-- AlterTable
ALTER TABLE "LogAuditoria" ADD COLUMN "perfilAtivoNome" TEXT;
ALTER TABLE "LogAuditoria" ADD COLUMN "secretariaAtivaId" TEXT;
ALTER TABLE "LogAuditoria" ADD COLUMN "secretariaAtivaSigla" TEXT;
ALTER TABLE "LogAuditoria" ADD COLUMN "tela" TEXT;
ALTER TABLE "LogAuditoria" ADD COLUMN "funcao" TEXT;
ALTER TABLE "LogAuditoria" ADD COLUMN "descricao" TEXT;

-- CreateIndex
CREATE INDEX "LogAuditoria_tela_idx" ON "LogAuditoria"("tela");
CREATE INDEX "LogAuditoria_secretariaAtivaId_idx" ON "LogAuditoria"("secretariaAtivaId");

-- CreateTable
CREATE TABLE "AuditoriaConfig" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "telaId" TEXT NOT NULL,
    "funcaoId" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditoriaConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuditoriaConfig_chave_key" ON "AuditoriaConfig"("chave");
CREATE INDEX "AuditoriaConfig_telaId_funcaoId_idx" ON "AuditoriaConfig"("telaId", "funcaoId");
CREATE INDEX "AuditoriaConfig_ativo_idx" ON "AuditoriaConfig"("ativo");

-- AlterTable
ALTER TABLE "OfflineSyncEvent" ADD COLUMN "ignoradoEm" TIMESTAMP(3);
ALTER TABLE "OfflineSyncEvent" ADD COLUMN "ignoradoPorId" TEXT;
ALTER TABLE "OfflineSyncEvent" ADD COLUMN "justificativaIgnorar" TEXT;

CREATE INDEX "OfflineSyncEvent_ignoradoPorId_idx" ON "OfflineSyncEvent"("ignoradoPorId");

ALTER TABLE "OfflineSyncEvent" ADD CONSTRAINT "OfflineSyncEvent_ignoradoPorId_fkey" FOREIGN KEY ("ignoradoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
