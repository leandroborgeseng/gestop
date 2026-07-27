-- CreateTable
CREATE TABLE "BackupS3Config" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "bucket" TEXT,
    "region" TEXT NOT NULL DEFAULT 'auto',
    "accessKeyId" TEXT,
    "secretAccessKeyEnc" TEXT,
    "prefix" TEXT NOT NULL DEFAULT 'sigma-backups',
    "dailyHour" INTEGER NOT NULL DEFAULT 2,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "endpoint" TEXT,
    "forcePathStyle" BOOLEAN NOT NULL DEFAULT false,
    "keepDaily" INTEGER NOT NULL DEFAULT 7,
    "keepWeekly" INTEGER NOT NULL DEFAULT 5,
    "keepMonthly" INTEGER NOT NULL DEFAULT 12,
    "envImportedAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "lastRunStatus" TEXT,
    "lastRunError" TEXT,
    "lastRunTrigger" TEXT,
    "lastRunObjectKey" TEXT,
    "lastRunBytes" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackupS3Config_pkey" PRIMARY KEY ("id")
);
