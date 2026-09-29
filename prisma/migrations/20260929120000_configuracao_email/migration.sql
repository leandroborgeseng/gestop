CREATE TABLE "ConfiguracaoEmail" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "remetenteEmail" TEXT,
    "remetenteNome" TEXT,
    "replyTo" TEXT,
    "smtpHost" TEXT,
    "smtpPort" INTEGER NOT NULL DEFAULT 587,
    "seguranca" TEXT NOT NULL DEFAULT 'TLS',
    "usarAutenticacao" BOOLEAN NOT NULL DEFAULT true,
    "usuario" TEXT,
    "senhaEnc" TEXT,
    "assuntoEquipe" TEXT,
    "textoIntroEquipe" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracaoEmail_pkey" PRIMARY KEY ("id")
);
