-- CreateEnum
CREATE TYPE "ChamadoTarefaStatus" AS ENUM ('NOVA', 'VISUALIZADA', 'EM_ANDAMENTO', 'IMPEDIDA', 'CONCLUIDA', 'CANCELADA');

-- CreateTable
CREATE TABLE "ChamadoTarefa" (
    "id" TEXT NOT NULL,
    "chamadoId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "prazo" TIMESTAMP(3),
    "secretariaId" TEXT NOT NULL,
    "equipeId" TEXT,
    "responsavelId" TEXT,
    "prioridade" "ChamadoPrioridade" NOT NULL DEFAULT 'MEDIA',
    "status" "ChamadoTarefaStatus" NOT NULL DEFAULT 'NOVA',
    "justificativa" TEXT,
    "conclusaoTexto" TEXT,
    "observacao" TEXT,
    "visualizadaEm" TIMESTAMP(3),
    "concluidaEm" TIMESTAMP(3),
    "concluidaPorId" TEXT,
    "canceladaEm" TIMESTAMP(3),
    "criadaPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChamadoTarefa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChamadoTarefaAnexo" (
    "id" TEXT NOT NULL,
    "tarefaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "storageKey" TEXT,
    "mimeType" TEXT,
    "tamanhoBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" TEXT,

    CONSTRAINT "ChamadoTarefaAnexo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChamadoTarefa_chamadoId_idx" ON "ChamadoTarefa"("chamadoId");
CREATE INDEX "ChamadoTarefa_secretariaId_idx" ON "ChamadoTarefa"("secretariaId");
CREATE INDEX "ChamadoTarefa_equipeId_idx" ON "ChamadoTarefa"("equipeId");
CREATE INDEX "ChamadoTarefa_responsavelId_idx" ON "ChamadoTarefa"("responsavelId");
CREATE INDEX "ChamadoTarefa_status_idx" ON "ChamadoTarefa"("status");
CREATE INDEX "ChamadoTarefa_prazo_idx" ON "ChamadoTarefa"("prazo");
CREATE INDEX "ChamadoTarefa_criadaPorId_idx" ON "ChamadoTarefa"("criadaPorId");
CREATE INDEX "ChamadoTarefaAnexo_tarefaId_idx" ON "ChamadoTarefaAnexo"("tarefaId");
CREATE INDEX "ChamadoTarefaAnexo_criadoPorId_idx" ON "ChamadoTarefaAnexo"("criadoPorId");

-- AddForeignKey
ALTER TABLE "ChamadoTarefa" ADD CONSTRAINT "ChamadoTarefa_chamadoId_fkey" FOREIGN KEY ("chamadoId") REFERENCES "Chamado"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChamadoTarefa" ADD CONSTRAINT "ChamadoTarefa_secretariaId_fkey" FOREIGN KEY ("secretariaId") REFERENCES "Secretaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChamadoTarefa" ADD CONSTRAINT "ChamadoTarefa_equipeId_fkey" FOREIGN KEY ("equipeId") REFERENCES "Equipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChamadoTarefa" ADD CONSTRAINT "ChamadoTarefa_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChamadoTarefa" ADD CONSTRAINT "ChamadoTarefa_criadaPorId_fkey" FOREIGN KEY ("criadaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChamadoTarefa" ADD CONSTRAINT "ChamadoTarefa_concluidaPorId_fkey" FOREIGN KEY ("concluidaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChamadoTarefaAnexo" ADD CONSTRAINT "ChamadoTarefaAnexo_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES "ChamadoTarefa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChamadoTarefaAnexo" ADD CONSTRAINT "ChamadoTarefaAnexo_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
