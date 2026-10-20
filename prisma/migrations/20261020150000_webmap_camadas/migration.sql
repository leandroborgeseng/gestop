-- 296: camadas Webmap (somente aditiva)
-- CreateTable
CREATE TABLE "WebmapCamadaGrupo" (
    "id" TEXT NOT NULL,
    "chaveOrigem" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "removidaOrigem" BOOLEAN NOT NULL DEFAULT false,
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
    "bytesOrigem" INTEGER NOT NULL DEFAULT 0,
    "bbox" JSONB,
    "versaoAtual" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "removidaOrigem" BOOLEAN NOT NULL DEFAULT false,
    "removidaEm" TIMESTAMP(3),
    "commitSha" TEXT NOT NULL,
    "importadoEm" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebmapCamada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebmapElemento" (
    "id" TEXT NOT NULL,
    "camadaId" TEXT NOT NULL,
    "versao" TEXT NOT NULL,
    "fidOrigem" TEXT,
    "geometriaTipo" TEXT NOT NULL,
    "geometria" JSONB NOT NULL,
    "atributos" JSONB NOT NULL,
    "minLng" DOUBLE PRECISION NOT NULL,
    "minLat" DOUBLE PRECISION NOT NULL,
    "maxLng" DOUBLE PRECISION NOT NULL,
    "maxLat" DOUBLE PRECISION NOT NULL,

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

-- CreateIndex
CREATE UNIQUE INDEX "WebmapCamadaGrupo_chaveOrigem_key" ON "WebmapCamadaGrupo"("chaveOrigem");

-- CreateIndex
CREATE UNIQUE INDEX "WebmapCamada_chaveOrigem_key" ON "WebmapCamada"("chaveOrigem");

-- CreateIndex
CREATE INDEX "WebmapCamada_grupoId_idx" ON "WebmapCamada"("grupoId");

-- CreateIndex
CREATE INDEX "WebmapCamada_ativo_idx" ON "WebmapCamada"("ativo");

-- CreateIndex
CREATE INDEX "WebmapElemento_camadaId_versao_idx" ON "WebmapElemento"("camadaId", "versao");

-- CreateIndex
CREATE INDEX "WebmapElemento_camadaId_minLng_maxLng_minLat_maxLat_idx" ON "WebmapElemento"("camadaId", "minLng", "maxLng", "minLat", "maxLat");

-- CreateIndex
CREATE UNIQUE INDEX "WebmapIcone_sha256_key" ON "WebmapIcone"("sha256");

-- AddForeignKey
ALTER TABLE "WebmapCamada" ADD CONSTRAINT "WebmapCamada_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "WebmapCamadaGrupo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebmapElemento" ADD CONSTRAINT "WebmapElemento_camadaId_fkey" FOREIGN KEY ("camadaId") REFERENCES "WebmapCamada"("id") ON DELETE CASCADE ON UPDATE CASCADE;
