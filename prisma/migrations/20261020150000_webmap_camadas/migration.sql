-- 296: camadas Webmap (somente aditiva: CREATE TABLE/INDEX/FK entre tabelas Webmap*; sem extensões)
-- CreateTable
CREATE TABLE "WebmapCamadaGrupo" (
    "id" TEXT NOT NULL,
    "chaveOrigem" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "removidaOrigem" BOOLEAN NOT NULL DEFAULT false,
    "criadaPorImportacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebmapCamadaGrupo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebmapCamada" (
    "id" TEXT NOT NULL,
    "chaveOrigem" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "nomeOriginal" TEXT NOT NULL,
    "varOrigem" TEXT NOT NULL,
    "arquivoOrigem" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "geometriaTipo" TEXT NOT NULL,
    "estilo" JSONB NOT NULL,
    "estiloOriginal" TEXT NOT NULL,
    "shaArquivo" TEXT NOT NULL,
    "shaEstilo" TEXT,
    "totalElementos" INTEGER NOT NULL,
    "totalPontos" INTEGER NOT NULL DEFAULT 0,
    "totalLinhas" INTEGER NOT NULL DEFAULT 0,
    "totalPoligonos" INTEGER NOT NULL DEFAULT 0,
    "totalCorrigidos" INTEGER NOT NULL DEFAULT 0,
    "totalInvalidos" INTEGER NOT NULL DEFAULT 0,
    "errosLeitura" JSONB,
    "bytesOrigem" INTEGER NOT NULL DEFAULT 0,
    "bbox" JSONB,
    "versaoAtual" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "removidaOrigem" BOOLEAN NOT NULL DEFAULT false,
    "removidaEm" TIMESTAMP(3),
    "criadaPorImportacao" TEXT,
    "commitSha" TEXT NOT NULL,
    "importadoEm" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebmapCamada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebmapCamadaVersao" (
    "id" TEXT NOT NULL,
    "camadaId" TEXT NOT NULL,
    "importacaoId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "shaArquivo" TEXT NOT NULL,
    "totalElementos" INTEGER NOT NULL DEFAULT 0,
    "totalPontos" INTEGER NOT NULL DEFAULT 0,
    "totalLinhas" INTEGER NOT NULL DEFAULT 0,
    "totalPoligonos" INTEGER NOT NULL DEFAULT 0,
    "totalCorrigidos" INTEGER NOT NULL DEFAULT 0,
    "totalInvalidos" INTEGER NOT NULL DEFAULT 0,
    "errosLeitura" JSONB,
    "bbox" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebmapCamadaVersao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebmapElemento" (
    "id" TEXT NOT NULL,
    "camadaId" TEXT NOT NULL,
    "versao" TEXT NOT NULL,
    "fidOrigem" TEXT,
    "geometriaTipo" TEXT NOT NULL,
    "geometria" JSONB NOT NULL,
    "geometriaOriginal" JSONB,
    "corrigida" BOOLEAN NOT NULL DEFAULT false,
    "atributos" JSONB NOT NULL,
    "minLng" DOUBLE PRECISION,
    "minLat" DOUBLE PRECISION,
    "maxLng" DOUBLE PRECISION,
    "maxLat" DOUBLE PRECISION,
    "geometriaInvalida" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "WebmapElemento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebmapIcone" (
    "id" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebmapIcone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebmapImportacao" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "fase" TEXT,
    "usuarioId" TEXT,
    "usuarioNome" TEXT NOT NULL,
    "simulacaoId" TEXT,
    "fonteHash" TEXT,
    "iniciadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "heartbeatEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluidoEm" TIMESTAMP(3),
    "resultado" JSONB,
    "motivo" TEXT,

    CONSTRAINT "WebmapImportacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebmapCamadaGrupo_chaveOrigem_key" ON "WebmapCamadaGrupo"("chaveOrigem");

-- CreateIndex
CREATE UNIQUE INDEX "WebmapCamada_chaveOrigem_key" ON "WebmapCamada"("chaveOrigem");

-- CreateIndex
CREATE INDEX "WebmapCamada_grupoId_idx" ON "WebmapCamada"("grupoId");

-- CreateIndex
CREATE INDEX "WebmapCamada_ativo_idx" ON "WebmapCamada"("ativo");

-- CreateIndex
CREATE INDEX "WebmapCamadaVersao_camadaId_idx" ON "WebmapCamadaVersao"("camadaId");

-- CreateIndex
CREATE INDEX "WebmapCamadaVersao_importacaoId_idx" ON "WebmapCamadaVersao"("importacaoId");

-- CreateIndex
CREATE INDEX "WebmapElemento_camadaId_versao_idx" ON "WebmapElemento"("camadaId", "versao");

-- CreateIndex
CREATE INDEX "WebmapElemento_camadaId_minLng_maxLng_minLat_maxLat_idx" ON "WebmapElemento"("camadaId", "minLng", "maxLng", "minLat", "maxLat");

-- CreateIndex (versão/camada + bbox; o índice acima, sem versão, é mantido por decisão do TL)
CREATE INDEX "WebmapElemento_camadaId_versao_minLng_maxLng_minLat_maxLat_idx" ON "WebmapElemento"("camadaId", "versao", "minLng", "maxLng", "minLat", "maxLat");

-- CreateIndex
CREATE UNIQUE INDEX "WebmapIcone_sha256_key" ON "WebmapIcone"("sha256");

-- CreateIndex
CREATE INDEX "WebmapImportacao_status_idx" ON "WebmapImportacao"("status");

-- CreateIndex
CREATE INDEX "WebmapImportacao_iniciadoEm_idx" ON "WebmapImportacao"("iniciadoEm");

-- AddForeignKey
ALTER TABLE "WebmapCamada" ADD CONSTRAINT "WebmapCamada_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "WebmapCamadaGrupo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebmapCamadaVersao" ADD CONSTRAINT "WebmapCamadaVersao_camadaId_fkey" FOREIGN KEY ("camadaId") REFERENCES "WebmapCamada"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebmapElemento" ADD CONSTRAINT "WebmapElemento_camadaId_fkey" FOREIGN KEY ("camadaId") REFERENCES "WebmapCamada"("id") ON DELETE CASCADE ON UPDATE CASCADE;
