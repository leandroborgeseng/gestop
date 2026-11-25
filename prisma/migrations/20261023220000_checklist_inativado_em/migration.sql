-- 309/C4a: data de inativação do checklist (somente aditiva: coluna NULL, sem default, sem apagar nada).
ALTER TABLE "Checklist" ADD COLUMN "inativadoEm" TIMESTAMP(3);

-- Backfill só dos checklists hoje inativos, na ordem de confiança:
-- 1) última auditoria STATUS_CHANGE que levou ativo=false (309);
-- 2) última auditoria DELETE do checklist (inativação antiga, via DELETE /checklists/:id);
-- 3) updatedAt (antes do 309, inativar era a última escrita; é limite superior da data real).
UPDATE "Checklist" c
SET "inativadoEm" = COALESCE(
  (SELECT MAX(l."createdAt") FROM "LogAuditoria" l
     WHERE l."entidadeTipo" = 'Checklist' AND l."entidadeId" = c."id"
       AND l."acao" = 'STATUS_CHANGE' AND (l."valorNovo"->>'ativo') = 'false'),
  (SELECT MAX(l."createdAt") FROM "LogAuditoria" l
     WHERE l."entidadeTipo" = 'Checklist' AND l."entidadeId" = c."id" AND l."acao" = 'DELETE'),
  c."updatedAt"
)
WHERE c."ativo" = false AND c."inativadoEm" IS NULL;
