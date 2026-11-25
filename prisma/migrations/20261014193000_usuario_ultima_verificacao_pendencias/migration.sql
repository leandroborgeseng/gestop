-- 289: abertura diária automática do modal de Pendências. Coluna nula, sem default e sem backfill.
ALTER TABLE "Usuario" ADD COLUMN "ultimaVerificacaoPendencias" DATE;
