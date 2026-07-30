-- Tipos de proprio parametrizaveis (substitui o enum UnidadeTipo por catalogo editavel)

CREATE TABLE "TipoProprio" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "sistema" BOOLEAN NOT NULL DEFAULT false,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TipoProprio_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TipoProprio_codigo_key" ON "TipoProprio"("codigo");
CREATE INDEX "TipoProprio_ativo_idx" ON "TipoProprio"("ativo");

-- Seed dos tipos legados do enum UnidadeTipo
INSERT INTO "TipoProprio" ("id", "codigo", "nome", "descricao", "ativo", "sistema", "ordem", "createdAt", "updatedAt") VALUES
  (gen_random_uuid()::text, 'ESCOLA', 'Escola', 'Unidades escolares (creches, EMEBs, EJA, etc.)', true, true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'UBS', 'UBS', 'Unidades Basicas de Saude e afins.', true, true, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'PRACA', 'Praça', 'Praças e parques municipais.', true, true, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'PREDIO_ADMINISTRATIVO', 'Prédio administrativo', 'Sedes administrativas e secretarias.', true, true, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'ESPACO_ESPORTIVO', 'Espaço esportivo', 'Quadras, ginásios, campos, piscinas, etc.', true, true, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'OUTRO', 'Outro', 'Demais próprios não classificados.', true, true, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- UnidadePublica.tipo: enum -> texto (mantém o codigo atual)
ALTER TABLE "UnidadePublica" ALTER COLUMN "tipo" TYPE TEXT USING "tipo"::TEXT;

-- Checklist.unidadeTipo: enum -> texto (mantém o codigo atual)
ALTER TABLE "Checklist" ALTER COLUMN "unidadeTipo" TYPE TEXT USING "unidadeTipo"::TEXT;

-- Enum antigo não é mais referenciado por nenhuma coluna: seguro remover
DROP TYPE IF EXISTS "UnidadeTipo";
