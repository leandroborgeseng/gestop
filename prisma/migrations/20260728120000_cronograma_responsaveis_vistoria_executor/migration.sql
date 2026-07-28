-- CreateTable
CREATE TABLE "CronogramaChecagemResponsavel" (
    "cronogramaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CronogramaChecagemResponsavel_pkey" PRIMARY KEY ("cronogramaId","usuarioId")
);

-- AlterTable
ALTER TABLE "Fiscalizacao" ADD COLUMN "lancadoPorId" TEXT;
ALTER TABLE "Fiscalizacao" ADD COLUMN "realizadaPorNome" TEXT;

-- CreateIndex
CREATE INDEX "CronogramaChecagemResponsavel_usuarioId_idx" ON "CronogramaChecagemResponsavel"("usuarioId");
CREATE INDEX "Fiscalizacao_lancadoPorId_idx" ON "Fiscalizacao"("lancadoPorId");

-- AddForeignKey
ALTER TABLE "CronogramaChecagemResponsavel" ADD CONSTRAINT "CronogramaChecagemResponsavel_cronogramaId_fkey" FOREIGN KEY ("cronogramaId") REFERENCES "CronogramaChecagem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CronogramaChecagemResponsavel" ADD CONSTRAINT "CronogramaChecagemResponsavel_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Fiscalizacao" ADD CONSTRAINT "Fiscalizacao_lancadoPorId_fkey" FOREIGN KEY ("lancadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Migrate legacy single responsavelId into junction table
INSERT INTO "CronogramaChecagemResponsavel" ("cronogramaId", "usuarioId", "createdAt")
SELECT "id", "responsavelId", CURRENT_TIMESTAMP
FROM "CronogramaChecagem"
WHERE "responsavelId" IS NOT NULL
ON CONFLICT DO NOTHING;
