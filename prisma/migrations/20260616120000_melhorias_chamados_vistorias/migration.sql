-- CreateEnum
CREATE TYPE "RegiaoUnidade" AS ENUM ('NORTE', 'SUL', 'LESTE', 'OESTE', 'CENTRO');

-- AlterTable
ALTER TABLE "UnidadePublica" ADD COLUMN "regiao" "RegiaoUnidade";

-- CreateTable
CREATE TABLE "CategoriaVistoria" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoriaVistoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CategoriaVistoria_nome_key" ON "CategoriaVistoria"("nome");

-- AlterTable
ALTER TABLE "ChecklistItem" ADD COLUMN "categoriaVistoriaId" TEXT;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_categoriaVistoriaId_fkey" FOREIGN KEY ("categoriaVistoriaId") REFERENCES "CategoriaVistoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed categorias iniciais
INSERT INTO "CategoriaVistoria" ("id", "nome", "ativo", "createdAt", "updatedAt")
VALUES
  ('cat-vistoria-pintura', 'Pintura', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat-vistoria-piso', 'Piso', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat-vistoria-moveis', 'Móveis', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat-vistoria-equipamentos', 'Equipamentos', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
