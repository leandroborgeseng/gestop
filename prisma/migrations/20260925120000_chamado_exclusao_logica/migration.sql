-- AlterTable
ALTER TABLE "Chamado" ADD COLUMN "excluidoEm" TIMESTAMP(3),
ADD COLUMN "excluidoPorId" TEXT,
ADD COLUMN "exclusaoJustificativa" TEXT,
ADD COLUMN "exclusaoPerfilNome" TEXT,
ADD COLUMN "exclusaoSecretariaId" TEXT;

-- CreateIndex
CREATE INDEX "Chamado_excluidoEm_idx" ON "Chamado"("excluidoEm");

-- AddForeignKey
ALTER TABLE "Chamado" ADD CONSTRAINT "Chamado_excluidoPorId_fkey" FOREIGN KEY ("excluidoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chamado" ADD CONSTRAINT "Chamado_exclusaoSecretariaId_fkey" FOREIGN KEY ("exclusaoSecretariaId") REFERENCES "Secretaria"("id") ON DELETE SET NULL ON UPDATE CASCADE;
