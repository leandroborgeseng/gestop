-- CreateTable
CREATE TABLE "DocumentoChamado" (
    "documentoId" TEXT NOT NULL,
    "chamadoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "DocumentoChamado_pkey" PRIMARY KEY ("documentoId","chamadoId")
);

-- CreateIndex
CREATE INDEX "DocumentoChamado_chamadoId_idx" ON "DocumentoChamado"("chamadoId");
CREATE INDEX "DocumentoChamado_createdById_idx" ON "DocumentoChamado"("createdById");

-- AddForeignKey
ALTER TABLE "DocumentoChamado" ADD CONSTRAINT "DocumentoChamado_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "Documento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentoChamado" ADD CONSTRAINT "DocumentoChamado_chamadoId_fkey" FOREIGN KEY ("chamadoId") REFERENCES "Chamado"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentoChamado" ADD CONSTRAINT "DocumentoChamado_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Preserva o vínculo único antigo (avulso, vistoria e execução) na relação múltipla.
INSERT INTO "DocumentoChamado" ("documentoId", "chamadoId", "createdAt", "createdById")
SELECT d."id", d."chamadoId", d."createdAt", d."criadoPorId"
FROM "Documento" d
WHERE d."chamadoId" IS NOT NULL
ON CONFLICT ("documentoId", "chamadoId") DO NOTHING;
