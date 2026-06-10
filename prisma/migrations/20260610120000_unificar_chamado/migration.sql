-- Unifica OrdemServico em Chamado (opcao A)

ALTER TYPE "OrdemServicoPrioridade" RENAME TO "ChamadoPrioridade";
ALTER TYPE "NaoConformidadeStatus" RENAME VALUE 'OS_GERADA' TO 'CHAMADO_GERADO';

CREATE TYPE "ChamadoStatus_new" AS ENUM ('ABERTO', 'EM_TRIAGEM', 'EM_ATENDIMENTO', 'IMPEDIDO', 'CONCLUIDO', 'CANCELADO');
ALTER TYPE "ChamadoOrigem" ADD VALUE IF NOT EXISTS 'FISCALIZACAO';

ALTER TABLE "Chamado" ADD COLUMN IF NOT EXISTS "titulo" TEXT;
ALTER TABLE "Chamado" ADD COLUMN IF NOT EXISTS "naoConformidadeId" TEXT;
ALTER TABLE "Chamado" ADD COLUMN IF NOT EXISTS "responsavelId" TEXT;
ALTER TABLE "Chamado" ADD COLUMN IF NOT EXISTS "prazoEm" TIMESTAMP(3);
ALTER TABLE "Chamado" ADD COLUMN IF NOT EXISTS "concluidoEm" TIMESTAMP(3);
ALTER TABLE "Chamado" ADD COLUMN IF NOT EXISTS "impedimentoMotivo" TEXT;
ALTER TABLE "Chamado" ADD COLUMN "status_new" "ChamadoStatus_new";

ALTER TABLE "Evidencia" ADD COLUMN IF NOT EXISTS "chamadoId" TEXT;

-- Mescla dados da OS nos chamados vinculados
UPDATE "Chamado" c
SET
  "titulo" = COALESCE(c."titulo", o."titulo"),
  "naoConformidadeId" = COALESCE(c."naoConformidadeId", o."naoConformidadeId"),
  "responsavelId" = COALESCE(c."responsavelId", o."responsavelId"),
  "prazoEm" = COALESCE(c."prazoEm", o."prazoEm"),
  "concluidoEm" = COALESCE(c."concluidoEm", o."concluidaEm"),
  "impedimentoMotivo" = COALESCE(c."impedimentoMotivo", o."impedimentoMotivo"),
  "status_new" = CASE o."status"
    WHEN 'ABERTA' THEN 'ABERTO'::"ChamadoStatus_new"
    WHEN 'EM_TRIAGEM' THEN 'EM_TRIAGEM'::"ChamadoStatus_new"
    WHEN 'ATRIBUIDA' THEN 'EM_ATENDIMENTO'::"ChamadoStatus_new"
    WHEN 'EM_EXECUCAO' THEN 'EM_ATENDIMENTO'::"ChamadoStatus_new"
    WHEN 'IMPEDIDA' THEN 'IMPEDIDO'::"ChamadoStatus_new"
    WHEN 'CONCLUIDA' THEN 'CONCLUIDO'::"ChamadoStatus_new"
    WHEN 'CANCELADA' THEN 'CANCELADO'::"ChamadoStatus_new"
    ELSE 'EM_ATENDIMENTO'::"ChamadoStatus_new"
  END
FROM "OrdemServico" o
WHERE c."ordemServicoId" = o.id;

UPDATE "Chamado"
SET "status_new" = CASE status::text
  WHEN 'ABERTO' THEN 'ABERTO'::"ChamadoStatus_new"
  WHEN 'EM_TRIAGEM' THEN 'EM_TRIAGEM'::"ChamadoStatus_new"
  WHEN 'ENCAMINHADO_OS' THEN 'EM_ATENDIMENTO'::"ChamadoStatus_new"
  WHEN 'ENCERRADO' THEN 'CONCLUIDO'::"ChamadoStatus_new"
  WHEN 'CANCELADO' THEN 'CANCELADO'::"ChamadoStatus_new"
  ELSE 'ABERTO'::"ChamadoStatus_new"
END
WHERE "status_new" IS NULL;

-- OS avulsas viram chamados (mantem id/codigo)
INSERT INTO "Chamado" (
  id, codigo, "secretariaId", "unidadeId", "naoConformidadeId", titulo, descricao,
  "status_new", origem, prioridade, "responsavelId", "registradoPorId", "prazoEm", "concluidoEm", "impedimentoMotivo", "createdAt", "updatedAt"
)
SELECT
  o.id,
  o.codigo,
  o."secretariaId",
  o."unidadeId",
  o."naoConformidadeId",
  o.titulo,
  o.descricao,
  CASE o."status"
    WHEN 'ABERTA' THEN 'ABERTO'::"ChamadoStatus_new"
    WHEN 'EM_TRIAGEM' THEN 'EM_TRIAGEM'::"ChamadoStatus_new"
    WHEN 'ATRIBUIDA' THEN 'EM_ATENDIMENTO'::"ChamadoStatus_new"
    WHEN 'EM_EXECUCAO' THEN 'EM_ATENDIMENTO'::"ChamadoStatus_new"
    WHEN 'IMPEDIDA' THEN 'IMPEDIDO'::"ChamadoStatus_new"
    WHEN 'CONCLUIDA' THEN 'CONCLUIDO'::"ChamadoStatus_new"
    WHEN 'CANCELADA' THEN 'CANCELADO'::"ChamadoStatus_new"
    ELSE 'ABERTO'::"ChamadoStatus_new"
  END,
  CASE o.origem
    WHEN 'NAO_CONFORMIDADE' THEN 'FISCALIZACAO'::"ChamadoOrigem"
    WHEN 'QR_CODE' THEN 'QR_CODE'::"ChamadoOrigem"
    WHEN 'CHAMADO' THEN 'MANUAL'::"ChamadoOrigem"
    ELSE 'INTERNO'::"ChamadoOrigem"
  END,
  o.prioridade,
  o."responsavelId",
  o."solicitanteId",
  o."prazoEm",
  o."concluidaEm",
  o."impedimentoMotivo",
  o."createdAt",
  o."updatedAt"
FROM "OrdemServico" o
WHERE NOT EXISTS (SELECT 1 FROM "Chamado" c WHERE c."ordemServicoId" = o.id);

UPDATE "Evidencia" e
SET "chamadoId" = COALESCE(c.id, e."ordemServicoId")
FROM "OrdemServico" o
LEFT JOIN "Chamado" c ON c."ordemServicoId" = o.id
WHERE e."ordemServicoId" = o.id;

UPDATE "HistoricoStatus" h
SET "entidadeId" = c.id, "entidadeTipo" = 'Chamado'
FROM "Chamado" c
WHERE h."entidadeTipo" = 'OrdemServico' AND c."ordemServicoId" = h."entidadeId";

UPDATE "HistoricoStatus" h
SET "entidadeTipo" = 'Chamado'
WHERE h."entidadeTipo" = 'OrdemServico'
  AND EXISTS (SELECT 1 FROM "Chamado" c WHERE c.id = h."entidadeId");

ALTER TABLE "Chamado" DROP CONSTRAINT IF EXISTS "Chamado_ordemServicoId_fkey";
ALTER TABLE "Chamado" DROP COLUMN IF EXISTS "ordemServicoId";

ALTER TABLE "Chamado" DROP COLUMN IF EXISTS "status";
ALTER TABLE "Chamado" RENAME COLUMN "status_new" TO "status";
ALTER TABLE "Chamado" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "Chamado" ALTER COLUMN "status" SET DEFAULT 'ABERTO'::"ChamadoStatus_new";

DROP TYPE IF EXISTS "ChamadoStatus";
ALTER TYPE "ChamadoStatus_new" RENAME TO "ChamadoStatus";

ALTER TABLE "Evidencia" DROP CONSTRAINT IF EXISTS "Evidencia_ordemServicoId_fkey";
DROP INDEX IF EXISTS "Evidencia_ordemServicoId_idx";
ALTER TABLE "Evidencia" DROP COLUMN IF EXISTS "ordemServicoId";

ALTER TABLE "OrdemServico" DROP CONSTRAINT IF EXISTS "OrdemServico_naoConformidadeId_fkey";
DROP TABLE IF EXISTS "OrdemServico";

ALTER TABLE "Chamado" ADD CONSTRAINT "Chamado_naoConformidadeId_fkey"
  FOREIGN KEY ("naoConformidadeId") REFERENCES "NaoConformidade"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Chamado" ADD CONSTRAINT "Chamado_responsavelId_fkey"
  FOREIGN KEY ("responsavelId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Evidencia" ADD CONSTRAINT "Evidencia_chamadoId_fkey"
  FOREIGN KEY ("chamadoId") REFERENCES "Chamado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "Chamado_naoConformidadeId_key" ON "Chamado"("naoConformidadeId");
CREATE INDEX IF NOT EXISTS "Chamado_responsavelId_idx" ON "Chamado"("responsavelId");
CREATE INDEX IF NOT EXISTS "Chamado_prioridade_idx" ON "Chamado"("prioridade");
CREATE INDEX IF NOT EXISTS "Evidencia_chamadoId_idx" ON "Evidencia"("chamadoId");

DROP TYPE IF EXISTS "OrdemServicoStatus";
DROP TYPE IF EXISTS "OrdemServicoOrigem";

ALTER TYPE "EntidadeSincronizavel" RENAME VALUE 'ORDEM_SERVICO' TO 'CHAMADO';
