-- Sequência atômica para códigos CH- e backfill de EM_EXECUCAO legado

CREATE TABLE "ChamadoSequencia" (
  "ano" INTEGER NOT NULL,
  "ultimo" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ChamadoSequencia_pkey" PRIMARY KEY ("ano")
);

INSERT INTO "ChamadoSequencia" ("ano", "ultimo")
SELECT
  EXTRACT(YEAR FROM NOW())::INTEGER,
  COALESCE(
    MAX(
      NULLIF(
        SUBSTRING(codigo FROM '^CH-[0-9]{4}-([0-9]{6})$'),
        ''
      )::INTEGER
    ),
    0
  )
FROM "Chamado"
WHERE codigo ~ '^CH-[0-9]{4}-[0-9]{6}$';

-- Chamados legados de OS em execução foram mapeados para EM_ATENDIMENTO
UPDATE "Chamado" c
SET status = 'EM_EXECUCAO'
WHERE c.status = 'EM_ATENDIMENTO'
  AND EXISTS (
    SELECT 1
    FROM "HistoricoStatus" h
    WHERE h."entidadeTipo" = 'Chamado'
      AND h."entidadeId" = c.id
      AND (
        h."statusNovo"::text = 'EM_EXECUCAO'
        OR (h.metadata::jsonb ->> 'tipo') = 'execucao_checkin'
      )
  );
