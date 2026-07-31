-- CreateEnum
CREATE TYPE "DocumentoTipo" AS ENUM (
  'RELATORIO_VISTORIA',
  'CHECKLIST_PREENCHIDO',
  'RELATORIO_EXECUCAO',
  'RELATORIO_FOTOGRAFICO',
  'NOTIFICACAO',
  'AUTO',
  'TERMO',
  'TERMO_CIENCIA',
  'DOCUMENTO_AVULSO',
  'OUTRO'
);

-- CreateEnum
CREATE TYPE "DocumentoSituacao" AS ENUM (
  'RASCUNHO',
  'GERADO',
  'SEM_ASSINATURA_EXTERNA',
  'ASSINATURA_PENDENTE',
  'ASSINADO_VIGENTE',
  'CANCELADO',
  'SUBSTITUIDO',
  'INVALIDO'
);

-- CreateEnum
CREATE TYPE "DocumentoOrigem" AS ENUM (
  'VISTORIA',
  'CHAMADO_EXECUCAO',
  'AVULSO',
  'SISTEMA'
);

-- CreateTable
CREATE TABLE "DocumentoSequencia" (
    "ano" INTEGER NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DocumentoSequencia_pkey" PRIMARY KEY ("ano")
);

-- CreateTable
CREATE TABLE "Documento" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "codigoValidacao" TEXT NOT NULL,
    "tipo" "DocumentoTipo" NOT NULL,
    "situacao" "DocumentoSituacao" NOT NULL DEFAULT 'GERADO',
    "origem" "DocumentoOrigem" NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "secretariaId" TEXT NOT NULL,
    "unidadeId" TEXT,
    "chamadoId" TEXT,
    "fiscalizacaoId" TEXT,
    "checklistVersaoId" TEXT,
    "enderecoTexto" TEXT,
    "responsavelId" TEXT,
    "criadoPorId" TEXT,
    "pdfOriginalStorageKey" TEXT,
    "pdfOriginalUrl" TEXT,
    "pdfAssinadoStorageKey" TEXT,
    "pdfAssinadoUrl" TEXT,
    "substituidoPorId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentoAssinatura" (
    "id" TEXT NOT NULL,
    "documentoId" TEXT NOT NULL,
    "assinanteNome" TEXT NOT NULL,
    "assinanteDocumento" TEXT,
    "assinanteUsuarioId" TEXT,
    "canal" TEXT NOT NULL DEFAULT 'registro',
    "evidenciaStorageKey" TEXT,
    "evidenciaUrl" TEXT,
    "coletadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "coletadaPorId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentoAssinatura_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Documento_codigo_key" ON "Documento"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Documento_codigoValidacao_key" ON "Documento"("codigoValidacao");

-- CreateIndex
CREATE INDEX "Documento_secretariaId_idx" ON "Documento"("secretariaId");

-- CreateIndex
CREATE INDEX "Documento_unidadeId_idx" ON "Documento"("unidadeId");

-- CreateIndex
CREATE INDEX "Documento_chamadoId_idx" ON "Documento"("chamadoId");

-- CreateIndex
CREATE INDEX "Documento_fiscalizacaoId_idx" ON "Documento"("fiscalizacaoId");

-- CreateIndex
CREATE INDEX "Documento_checklistVersaoId_idx" ON "Documento"("checklistVersaoId");

-- CreateIndex
CREATE INDEX "Documento_responsavelId_idx" ON "Documento"("responsavelId");

-- CreateIndex
CREATE INDEX "Documento_criadoPorId_idx" ON "Documento"("criadoPorId");

-- CreateIndex
CREATE INDEX "Documento_tipo_idx" ON "Documento"("tipo");

-- CreateIndex
CREATE INDEX "Documento_situacao_idx" ON "Documento"("situacao");

-- CreateIndex
CREATE INDEX "Documento_origem_idx" ON "Documento"("origem");

-- CreateIndex
CREATE INDEX "Documento_createdAt_idx" ON "Documento"("createdAt");

-- CreateIndex
CREATE INDEX "Documento_codigoValidacao_idx" ON "Documento"("codigoValidacao");

-- CreateIndex
CREATE INDEX "DocumentoAssinatura_documentoId_idx" ON "DocumentoAssinatura"("documentoId");

-- CreateIndex
CREATE INDEX "DocumentoAssinatura_assinanteUsuarioId_idx" ON "DocumentoAssinatura"("assinanteUsuarioId");

-- CreateIndex
CREATE INDEX "DocumentoAssinatura_coletadaPorId_idx" ON "DocumentoAssinatura"("coletadaPorId");

-- CreateIndex
CREATE INDEX "DocumentoAssinatura_coletadaEm_idx" ON "DocumentoAssinatura"("coletadaEm");

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_secretariaId_fkey" FOREIGN KEY ("secretariaId") REFERENCES "Secretaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "UnidadePublica"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_chamadoId_fkey" FOREIGN KEY ("chamadoId") REFERENCES "Chamado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_fiscalizacaoId_fkey" FOREIGN KEY ("fiscalizacaoId") REFERENCES "Fiscalizacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_checklistVersaoId_fkey" FOREIGN KEY ("checklistVersaoId") REFERENCES "ChecklistVersao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_substituidoPorId_fkey" FOREIGN KEY ("substituidoPorId") REFERENCES "Documento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoAssinatura" ADD CONSTRAINT "DocumentoAssinatura_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "Documento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoAssinatura" ADD CONSTRAINT "DocumentoAssinatura_assinanteUsuarioId_fkey" FOREIGN KEY ("assinanteUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoAssinatura" ADD CONSTRAINT "DocumentoAssinatura_coletadaPorId_fkey" FOREIGN KEY ("coletadaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
