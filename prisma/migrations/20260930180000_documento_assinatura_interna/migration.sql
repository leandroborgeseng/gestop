-- CreateEnum
CREATE TYPE "DocumentoAssinaturaPedidoStatus" AS ENUM ('PENDENTE', 'ASSINADO', 'CANCELADO', 'RETIRADO');

-- CreateTable
CREATE TABLE "DocumentoAssinaturaPedido" (
    "id" TEXT NOT NULL,
    "documentoId" TEXT NOT NULL,
    "destinatarioId" TEXT NOT NULL,
    "solicitanteId" TEXT NOT NULL,
    "status" "DocumentoAssinaturaPedidoStatus" NOT NULL DEFAULT 'PENDENTE',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signedAt" TIMESTAMP(3),
    "canceladoEm" TIMESTAMP(3),
    "canceladoMotivo" TEXT,
    "retiradoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentoAssinaturaPedido_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentoAssinaturaPedido_documentoId_idx" ON "DocumentoAssinaturaPedido"("documentoId");

-- CreateIndex
CREATE INDEX "DocumentoAssinaturaPedido_destinatarioId_status_idx" ON "DocumentoAssinaturaPedido"("destinatarioId", "status");

-- CreateIndex
CREATE INDEX "DocumentoAssinaturaPedido_solicitanteId_idx" ON "DocumentoAssinaturaPedido"("solicitanteId");

-- CreateIndex
CREATE INDEX "DocumentoAssinaturaPedido_status_idx" ON "DocumentoAssinaturaPedido"("status");

-- AddForeignKey
ALTER TABLE "DocumentoAssinaturaPedido" ADD CONSTRAINT "DocumentoAssinaturaPedido_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "Documento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoAssinaturaPedido" ADD CONSTRAINT "DocumentoAssinaturaPedido_destinatarioId_fkey" FOREIGN KEY ("destinatarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoAssinaturaPedido" ADD CONSTRAINT "DocumentoAssinaturaPedido_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
