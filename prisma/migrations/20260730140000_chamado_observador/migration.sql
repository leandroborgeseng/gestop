-- Observadores de chamado (acompanhamento sem acesso à triagem/CCO)

CREATE TABLE "ChamadoObservador" (
  "id" TEXT NOT NULL,
  "chamadoId" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,
  "origem" TEXT,

  CONSTRAINT "ChamadoObservador_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChamadoObservador_chamadoId_usuarioId_key" ON "ChamadoObservador"("chamadoId", "usuarioId");

CREATE INDEX "ChamadoObservador_usuarioId_idx" ON "ChamadoObservador"("usuarioId");

CREATE INDEX "ChamadoObservador_chamadoId_idx" ON "ChamadoObservador"("chamadoId");

CREATE INDEX "ChamadoObservador_createdById_idx" ON "ChamadoObservador"("createdById");

ALTER TABLE "ChamadoObservador"
  ADD CONSTRAINT "ChamadoObservador_chamadoId_fkey"
  FOREIGN KEY ("chamadoId") REFERENCES "Chamado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChamadoObservador"
  ADD CONSTRAINT "ChamadoObservador_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChamadoObservador"
  ADD CONSTRAINT "ChamadoObservador_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
