-- CreateEnum
CREATE TYPE "ChamadoModoLocalizacao" AS ENUM ('UNIDADE', 'GEOLOCALIZACAO', 'ENDERECO');

-- AlterTable
ALTER TABLE "Chamado" ADD COLUMN "modoLocalizacao" "ChamadoModoLocalizacao" NOT NULL DEFAULT 'UNIDADE';
ALTER TABLE "Chamado" ADD COLUMN "enderecoTexto" TEXT;
ALTER TABLE "Chamado" ADD COLUMN "enderecoBairro" TEXT;
ALTER TABLE "Chamado" ADD COLUMN "previstaExecucaoEm" TIMESTAMP(3);

-- Make unidadeId optional
ALTER TABLE "Chamado" DROP CONSTRAINT "Chamado_unidadeId_fkey";
ALTER TABLE "Chamado" ALTER COLUMN "unidadeId" DROP NOT NULL;
ALTER TABLE "Chamado" ADD CONSTRAINT "Chamado_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "UnidadePublica"("id") ON DELETE SET NULL ON UPDATE CASCADE;
