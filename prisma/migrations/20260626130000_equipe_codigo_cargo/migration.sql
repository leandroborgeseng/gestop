-- Item 92: código único na equipe
-- Item 93: cadastro de cargos

CREATE TABLE "Cargo" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cargo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Cargo_nome_key" ON "Cargo"("nome");

ALTER TABLE "Equipe" ADD COLUMN "codigo" TEXT;

UPDATE "Equipe" SET "codigo" = UPPER(REGEXP_REPLACE(LEFT("nome", 12), '[^A-Z0-9]', '', 'g')) || '-' || SUBSTRING("id", 1, 4)
WHERE "codigo" IS NULL;

ALTER TABLE "Equipe" ALTER COLUMN "codigo" SET NOT NULL;

CREATE UNIQUE INDEX "Equipe_codigo_key" ON "Equipe"("codigo");

ALTER TABLE "Usuario" ADD COLUMN "cargoId" TEXT;

ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "Cargo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Usuario_cargoId_idx" ON "Usuario"("cargoId");
