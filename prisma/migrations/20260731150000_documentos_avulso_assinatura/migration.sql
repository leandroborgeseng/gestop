-- Enum value DOCUMENTO_AVULSO (fora de bloco transacional problemático)
DO $$ BEGIN
  ALTER TYPE "ChecklistFinalidade" ADD VALUE 'DOCUMENTO_AVULSO';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Checklist" ADD COLUMN IF NOT EXISTS "finalidades" "ChecklistFinalidade"[];

UPDATE "Checklist"
SET "finalidades" = ARRAY["finalidade"]::"ChecklistFinalidade"[]
WHERE "finalidades" IS NULL OR cardinality("finalidades") = 0;

ALTER TABLE "Checklist" ALTER COLUMN "finalidades" SET DEFAULT ARRAY['VISTORIA']::"ChecklistFinalidade"[];

ALTER TABLE "Documento" ADD COLUMN IF NOT EXISTS "latitude" DECIMAL(10,7);
ALTER TABLE "Documento" ADD COLUMN IF NOT EXISTS "longitude" DECIMAL(10,7);
ALTER TABLE "Documento" ADD COLUMN IF NOT EXISTS "pdfOriginalSha256" TEXT;
ALTER TABLE "Documento" ADD COLUMN IF NOT EXISTS "pdfAssinadoSha256" TEXT;
ALTER TABLE "Documento" ADD COLUMN IF NOT EXISTS "conteudoTravadoEm" TIMESTAMP(3);

ALTER TABLE "DocumentoAssinatura" ADD COLUMN IF NOT EXISTS "assinanteEmail" TEXT;
ALTER TABLE "DocumentoAssinatura" ADD COLUMN IF NOT EXISTS "qualificacao" TEXT;
ALTER TABLE "DocumentoAssinatura" ADD COLUMN IF NOT EXISTS "qualificacaoOutro" TEXT;
ALTER TABLE "DocumentoAssinatura" ADD COLUMN IF NOT EXISTS "evidenciaSha256" TEXT;
ALTER TABLE "DocumentoAssinatura" ADD COLUMN IF NOT EXISTS "timezone" TEXT;
ALTER TABLE "DocumentoAssinatura" ADD COLUMN IF NOT EXISTS "ip" TEXT;
ALTER TABLE "DocumentoAssinatura" ADD COLUMN IF NOT EXISTS "userAgent" TEXT;
ALTER TABLE "DocumentoAssinatura" ADD COLUMN IF NOT EXISTS "dispositivo" TEXT;
ALTER TABLE "DocumentoAssinatura" ADD COLUMN IF NOT EXISTS "sessaoId" TEXT;
ALTER TABLE "DocumentoAssinatura" ADD COLUMN IF NOT EXISTS "latitude" DECIMAL(10,7);
ALTER TABLE "DocumentoAssinatura" ADD COLUMN IF NOT EXISTS "longitude" DECIMAL(10,7);
ALTER TABLE "DocumentoAssinatura" ADD COLUMN IF NOT EXISTS "precisaoMetros" DECIMAL(8,2);
ALTER TABLE "DocumentoAssinatura" ADD COLUMN IF NOT EXISTS "localizacaoEm" TIMESTAMP(3);
ALTER TABLE "DocumentoAssinatura" ADD COLUMN IF NOT EXISTS "pdfOriginalSha256" TEXT;
ALTER TABLE "DocumentoAssinatura" ADD COLUMN IF NOT EXISTS "pdfAssinadoSha256" TEXT;
ALTER TABLE "DocumentoAssinatura" ADD COLUMN IF NOT EXISTS "invalida" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DocumentoAssinatura" ADD COLUMN IF NOT EXISTS "invalidadaEm" TIMESTAMP(3);
ALTER TABLE "DocumentoAssinatura" ADD COLUMN IF NOT EXISTS "invalidadaMotivo" TEXT;

CREATE INDEX IF NOT EXISTS "DocumentoAssinatura_invalida_idx" ON "DocumentoAssinatura"("invalida");

CREATE TABLE IF NOT EXISTS "DocumentoResposta" (
    "id" TEXT NOT NULL,
    "documentoId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "conformidade" "ConformidadeStatus",
    "valorTexto" TEXT,
    "valorNumero" DECIMAL(14,4),
    "valorBooleano" BOOLEAN,
    "valorJson" JSONB,
    "comentario" TEXT,
    "respondidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DocumentoResposta_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DocumentoResposta_documentoId_itemId_key" ON "DocumentoResposta"("documentoId", "itemId");
CREATE INDEX IF NOT EXISTS "DocumentoResposta_itemId_idx" ON "DocumentoResposta"("itemId");
CREATE INDEX IF NOT EXISTS "DocumentoResposta_conformidade_idx" ON "DocumentoResposta"("conformidade");

DO $$ BEGIN
  ALTER TABLE "DocumentoResposta" ADD CONSTRAINT "DocumentoResposta_documentoId_fkey"
    FOREIGN KEY ("documentoId") REFERENCES "Documento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "DocumentoResposta" ADD CONSTRAINT "DocumentoResposta_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "ChecklistItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
