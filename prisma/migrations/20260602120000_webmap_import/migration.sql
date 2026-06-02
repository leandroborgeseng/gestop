-- CreateTable
CREATE TABLE "WebmapImport" (
    "id" TEXT NOT NULL,
    "githubCommitSha" TEXT NOT NULL,
    "commitMessage" TEXT,
    "dryRun" BOOLEAN NOT NULL DEFAULT false,
    "triggeredBy" TEXT NOT NULL DEFAULT 'manual',
    "featuresRead" INTEGER NOT NULL,
    "uniqueUnits" INTEGER NOT NULL,
    "created" INTEGER NOT NULL,
    "updated" INTEGER NOT NULL,
    "skipped" INTEGER NOT NULL,
    "deactivated" INTEGER NOT NULL DEFAULT 0,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0,
    "layersProcessed" INTEGER NOT NULL,
    "layersFailed" INTEGER NOT NULL,
    "layersDiscovered" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER,
    "result" JSONB NOT NULL,
    "usuarioId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebmapImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebmapImport_githubCommitSha_idx" ON "WebmapImport"("githubCommitSha");

-- CreateIndex
CREATE INDEX "WebmapImport_createdAt_idx" ON "WebmapImport"("createdAt");

-- CreateIndex
CREATE INDEX "WebmapImport_usuarioId_idx" ON "WebmapImport"("usuarioId");

-- AddForeignKey
ALTER TABLE "WebmapImport" ADD CONSTRAINT "WebmapImport_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
