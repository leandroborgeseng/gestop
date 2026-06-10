-- CreateTable
CREATE TABLE "Equipe" (
    "id" TEXT NOT NULL,
    "secretariaId" TEXT,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Equipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipeUsuario" (
    "equipeId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipeUsuario_pkey" PRIMARY KEY ("equipeId","usuarioId")
);

-- AlterTable
ALTER TABLE "Chamado" ADD COLUMN "equipeId" TEXT;

-- CreateIndex
CREATE INDEX "Equipe_ativo_idx" ON "Equipe"("ativo");

-- CreateIndex
CREATE UNIQUE INDEX "Equipe_secretariaId_nome_key" ON "Equipe"("secretariaId", "nome");

-- CreateIndex
CREATE INDEX "EquipeUsuario_usuarioId_idx" ON "EquipeUsuario"("usuarioId");

-- CreateIndex
CREATE INDEX "Chamado_equipeId_idx" ON "Chamado"("equipeId");

-- AddForeignKey
ALTER TABLE "Equipe" ADD CONSTRAINT "Equipe_secretariaId_fkey" FOREIGN KEY ("secretariaId") REFERENCES "Secretaria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipeUsuario" ADD CONSTRAINT "EquipeUsuario_equipeId_fkey" FOREIGN KEY ("equipeId") REFERENCES "Equipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipeUsuario" ADD CONSTRAINT "EquipeUsuario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chamado" ADD CONSTRAINT "Chamado_equipeId_fkey" FOREIGN KEY ("equipeId") REFERENCES "Equipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;
