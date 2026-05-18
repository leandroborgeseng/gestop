-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- EnablePostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- CreateEnum
CREATE TYPE "UnidadeTipo" AS ENUM ('ESCOLA', 'UBS', 'PRACA', 'PREDIO_ADMINISTRATIVO', 'ESPACO_ESPORTIVO', 'OUTRO');

-- CreateEnum
CREATE TYPE "ChecklistEscopo" AS ENUM ('GLOBAL', 'SECRETARIA', 'UNIDADE_TIPO', 'UNIDADE');

-- CreateEnum
CREATE TYPE "ChecklistVersaoStatus" AS ENUM ('RASCUNHO', 'PUBLICADA', 'ARQUIVADA');

-- CreateEnum
CREATE TYPE "ChecklistItemTipo" AS ENUM ('TEXTO', 'NUMERO', 'BOOLEANO', 'MULTIPLA_ESCOLHA', 'FOTO', 'ASSINATURA', 'DATA');

-- CreateEnum
CREATE TYPE "FiscalizacaoStatus" AS ENUM ('PLANEJADA', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA', 'SINCRONIZACAO_PENDENTE');

-- CreateEnum
CREATE TYPE "FiscalizacaoOrigem" AS ENUM ('ROTINA', 'CHAMADO', 'AVULSA', 'OFFLINE');

-- CreateEnum
CREATE TYPE "ConformidadeStatus" AS ENUM ('CONFORME', 'NAO_CONFORME', 'NAO_APLICAVEL');

-- CreateEnum
CREATE TYPE "EvidenciaTipo" AS ENUM ('FOTO', 'VIDEO', 'AUDIO', 'DOCUMENTO', 'ASSINATURA');

-- CreateEnum
CREATE TYPE "NaoConformidadeStatus" AS ENUM ('ABERTA', 'EM_TRIAGEM', 'OS_GERADA', 'RESOLVIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "Severidade" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA');

-- CreateEnum
CREATE TYPE "OrdemServicoStatus" AS ENUM ('ABERTA', 'EM_TRIAGEM', 'ATRIBUIDA', 'EM_EXECUCAO', 'CONCLUIDA', 'IMPEDIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "OrdemServicoPrioridade" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'URGENTE');

-- CreateEnum
CREATE TYPE "OrdemServicoOrigem" AS ENUM ('MANUAL', 'NAO_CONFORMIDADE', 'QR_CODE', 'INTEGRACAO');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'STATUS_CHANGE', 'SYNC', 'PERMISSION_CHANGE');

-- CreateEnum
CREATE TYPE "OfflineOperacao" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'UPSERT');

-- CreateEnum
CREATE TYPE "OfflineSyncStatus" AS ENUM ('PENDENTE', 'PROCESSANDO', 'SINCRONIZADO', 'CONFLITO', 'FALHOU', 'IGNORADO');

-- CreateEnum
CREATE TYPE "EntidadeSincronizavel" AS ENUM ('FISCALIZACAO', 'RESPOSTA_CHECKLIST', 'EVIDENCIA', 'NAO_CONFORMIDADE', 'ORDEM_SERVICO');

-- CreateEnum
CREATE TYPE "DashboardEscopo" AS ENUM ('GERAL', 'SECRETARIA', 'UNIDADE');

-- CreateTable
CREATE TABLE "Secretaria" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "sigla" TEXT NOT NULL,
    "descricao" TEXT,
    "responsavelNome" TEXT,
    "responsavelEmail" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Secretaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnidadePublica" (
    "id" TEXT NOT NULL,
    "secretariaId" TEXT NOT NULL,
    "codigoPatrimonial" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "UnidadeTipo" NOT NULL,
    "endereco" TEXT NOT NULL,
    "bairro" TEXT,
    "cep" TEXT,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "raioValidacaoMetros" INTEGER NOT NULL DEFAULT 200,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnidadePublica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "secretariaId" TEXT,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "cpf" TEXT,
    "senhaHash" TEXT NOT NULL,
    "telefone" TEXT,
    "cargo" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Perfil" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "sistema" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Perfil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permissao" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "descricao" TEXT,
    "modulo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permissao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsuarioPerfil" (
    "usuarioId" TEXT NOT NULL,
    "perfilId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsuarioPerfil_pkey" PRIMARY KEY ("usuarioId","perfilId")
);

-- CreateTable
CREATE TABLE "PerfilPermissao" (
    "perfilId" TEXT NOT NULL,
    "permissaoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerfilPermissao_pkey" PRIMARY KEY ("perfilId","permissaoId")
);

-- CreateTable
CREATE TABLE "Checklist" (
    "id" TEXT NOT NULL,
    "secretariaId" TEXT,
    "unidadeId" TEXT,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "escopo" "ChecklistEscopo" NOT NULL DEFAULT 'GLOBAL',
    "unidadeTipo" "UnidadeTipo",
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Checklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistVersao" (
    "id" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "status" "ChecklistVersaoStatus" NOT NULL DEFAULT 'RASCUNHO',
    "estrutura" JSONB,
    "publicadoAt" TIMESTAMP(3),
    "publicadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistVersao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "checklistVersaoId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" "ChecklistItemTipo" NOT NULL,
    "obrigatorio" BOOLEAN NOT NULL DEFAULT false,
    "geraNaoConformidade" BOOLEAN NOT NULL DEFAULT false,
    "exigeEvidencia" BOOLEAN NOT NULL DEFAULT false,
    "opcoes" JSONB,
    "peso" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fiscalizacao" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "secretariaId" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "checklistVersaoId" TEXT NOT NULL,
    "agenteId" TEXT NOT NULL,
    "status" "FiscalizacaoStatus" NOT NULL DEFAULT 'PLANEJADA',
    "origem" "FiscalizacaoOrigem" NOT NULL DEFAULT 'ROTINA',
    "iniciadaEm" TIMESTAMP(3),
    "concluidaEm" TIMESTAMP(3),
    "checkinLatitude" DECIMAL(10,7),
    "checkinLongitude" DECIMAL(10,7),
    "checkinPrecisaoMetros" DECIMAL(8,2),
    "checkoutLatitude" DECIMAL(10,7),
    "checkoutLongitude" DECIMAL(10,7),
    "checkoutPrecisaoMetros" DECIMAL(8,2),
    "distanciaCheckinMetros" DECIMAL(10,2),
    "dentroRaioPermitido" BOOLEAN,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fiscalizacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RespostaChecklist" (
    "id" TEXT NOT NULL,
    "fiscalizacaoId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "conformidade" "ConformidadeStatus",
    "valorTexto" TEXT,
    "valorNumero" DECIMAL(14,4),
    "valorBooleano" BOOLEAN,
    "valorJson" JSONB,
    "comentario" TEXT,
    "respondidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RespostaChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidencia" (
    "id" TEXT NOT NULL,
    "fiscalizacaoId" TEXT,
    "respostaId" TEXT,
    "naoConformidadeId" TEXT,
    "ordemServicoId" TEXT,
    "tipo" "EvidenciaTipo" NOT NULL,
    "url" TEXT NOT NULL,
    "storageKey" TEXT,
    "mimeType" TEXT,
    "tamanhoBytes" INTEGER,
    "checksum" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "precisaoMetros" DECIMAL(8,2),
    "capturadaEm" TIMESTAMP(3) NOT NULL,
    "enviadaEm" TIMESTAMP(3),
    "marcaDagua" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evidencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NaoConformidade" (
    "id" TEXT NOT NULL,
    "fiscalizacaoId" TEXT NOT NULL,
    "respostaId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "registradaPorId" TEXT NOT NULL,
    "severidade" "Severidade" NOT NULL DEFAULT 'MEDIA',
    "status" "NaoConformidadeStatus" NOT NULL DEFAULT 'ABERTA',
    "descricao" TEXT NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "evidenciaObrigatoriaAtendida" BOOLEAN NOT NULL DEFAULT false,
    "registradaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvidaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NaoConformidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdemServico" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "secretariaId" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "naoConformidadeId" TEXT,
    "solicitanteId" TEXT,
    "responsavelId" TEXT,
    "origem" "OrdemServicoOrigem" NOT NULL DEFAULT 'MANUAL',
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "prioridade" "OrdemServicoPrioridade" NOT NULL DEFAULT 'MEDIA',
    "status" "OrdemServicoStatus" NOT NULL DEFAULT 'ABERTA',
    "prazoEm" TIMESTAMP(3),
    "abertaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluidaEm" TIMESTAMP(3),
    "impedimentoMotivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrdemServico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoricoStatus" (
    "id" TEXT NOT NULL,
    "entidadeTipo" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "statusAnterior" TEXT,
    "statusNovo" TEXT NOT NULL,
    "motivo" TEXT,
    "metadata" JSONB,
    "alteradoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricoStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogAuditoria" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "acao" "AuditAction" NOT NULL,
    "entidadeTipo" TEXT NOT NULL,
    "entidadeId" TEXT,
    "valorAntigo" JSONB,
    "valorNovo" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfflineSyncEvent" (
    "id" TEXT NOT NULL,
    "clientEventId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "entidadeTipo" "EntidadeSincronizavel" NOT NULL,
    "entidadeId" TEXT,
    "operacao" "OfflineOperacao" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OfflineSyncStatus" NOT NULL DEFAULT 'PENDENTE',
    "conflitoMotivo" TEXT,
    "resolucao" JSONB,
    "ocorridoEm" TIMESTAMP(3) NOT NULL,
    "recebidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sincronizadoEm" TIMESTAMP(3),
    "resolvidoEm" TIMESTAMP(3),
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "ultimoErro" TEXT,

    CONSTRAINT "OfflineSyncEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardSnapshot" (
    "id" TEXT NOT NULL,
    "escopo" "DashboardEscopo" NOT NULL,
    "secretariaId" TEXT,
    "unidadeId" TEXT,
    "chave" TEXT NOT NULL,
    "periodoInicio" TIMESTAMP(3),
    "periodoFim" TIMESTAMP(3),
    "metricas" JSONB NOT NULL,
    "geradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DashboardSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Secretaria_sigla_key" ON "Secretaria"("sigla");

-- CreateIndex
CREATE INDEX "Secretaria_ativo_idx" ON "Secretaria"("ativo");

-- CreateIndex
CREATE UNIQUE INDEX "UnidadePublica_codigoPatrimonial_key" ON "UnidadePublica"("codigoPatrimonial");

-- CreateIndex
CREATE INDEX "UnidadePublica_secretariaId_idx" ON "UnidadePublica"("secretariaId");

-- CreateIndex
CREATE INDEX "UnidadePublica_tipo_idx" ON "UnidadePublica"("tipo");

-- CreateIndex
CREATE INDEX "UnidadePublica_ativo_idx" ON "UnidadePublica"("ativo");

-- CreateIndex
CREATE INDEX "UnidadePublica_latitude_longitude_idx" ON "UnidadePublica"("latitude", "longitude");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_cpf_key" ON "Usuario"("cpf");

-- CreateIndex
CREATE INDEX "Usuario_secretariaId_idx" ON "Usuario"("secretariaId");

-- CreateIndex
CREATE INDEX "Usuario_ativo_idx" ON "Usuario"("ativo");

-- CreateIndex
CREATE UNIQUE INDEX "Perfil_nome_key" ON "Perfil"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Permissao_chave_key" ON "Permissao"("chave");

-- CreateIndex
CREATE INDEX "Permissao_modulo_idx" ON "Permissao"("modulo");

-- CreateIndex
CREATE INDEX "Checklist_secretariaId_idx" ON "Checklist"("secretariaId");

-- CreateIndex
CREATE INDEX "Checklist_escopo_idx" ON "Checklist"("escopo");

-- CreateIndex
CREATE INDEX "Checklist_ativo_idx" ON "Checklist"("ativo");

-- CreateIndex
CREATE INDEX "ChecklistVersao_status_idx" ON "ChecklistVersao"("status");

-- CreateIndex
CREATE INDEX "ChecklistVersao_publicadoPorId_idx" ON "ChecklistVersao"("publicadoPorId");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistVersao_checklistId_versao_key" ON "ChecklistVersao"("checklistId", "versao");

-- CreateIndex
CREATE INDEX "ChecklistItem_checklistVersaoId_ordem_idx" ON "ChecklistItem"("checklistVersaoId", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistItem_checklistVersaoId_codigo_key" ON "ChecklistItem"("checklistVersaoId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Fiscalizacao_clientId_key" ON "Fiscalizacao"("clientId");

-- CreateIndex
CREATE INDEX "Fiscalizacao_secretariaId_idx" ON "Fiscalizacao"("secretariaId");

-- CreateIndex
CREATE INDEX "Fiscalizacao_unidadeId_idx" ON "Fiscalizacao"("unidadeId");

-- CreateIndex
CREATE INDEX "Fiscalizacao_checklistVersaoId_idx" ON "Fiscalizacao"("checklistVersaoId");

-- CreateIndex
CREATE INDEX "Fiscalizacao_agenteId_idx" ON "Fiscalizacao"("agenteId");

-- CreateIndex
CREATE INDEX "Fiscalizacao_status_idx" ON "Fiscalizacao"("status");

-- CreateIndex
CREATE INDEX "Fiscalizacao_createdAt_idx" ON "Fiscalizacao"("createdAt");

-- CreateIndex
CREATE INDEX "RespostaChecklist_itemId_idx" ON "RespostaChecklist"("itemId");

-- CreateIndex
CREATE INDEX "RespostaChecklist_conformidade_idx" ON "RespostaChecklist"("conformidade");

-- CreateIndex
CREATE UNIQUE INDEX "RespostaChecklist_fiscalizacaoId_itemId_key" ON "RespostaChecklist"("fiscalizacaoId", "itemId");

-- CreateIndex
CREATE INDEX "Evidencia_fiscalizacaoId_idx" ON "Evidencia"("fiscalizacaoId");

-- CreateIndex
CREATE INDEX "Evidencia_respostaId_idx" ON "Evidencia"("respostaId");

-- CreateIndex
CREATE INDEX "Evidencia_naoConformidadeId_idx" ON "Evidencia"("naoConformidadeId");

-- CreateIndex
CREATE INDEX "Evidencia_ordemServicoId_idx" ON "Evidencia"("ordemServicoId");

-- CreateIndex
CREATE INDEX "Evidencia_checksum_idx" ON "Evidencia"("checksum");

-- CreateIndex
CREATE UNIQUE INDEX "NaoConformidade_respostaId_key" ON "NaoConformidade"("respostaId");

-- CreateIndex
CREATE INDEX "NaoConformidade_fiscalizacaoId_idx" ON "NaoConformidade"("fiscalizacaoId");

-- CreateIndex
CREATE INDEX "NaoConformidade_itemId_idx" ON "NaoConformidade"("itemId");

-- CreateIndex
CREATE INDEX "NaoConformidade_unidadeId_idx" ON "NaoConformidade"("unidadeId");

-- CreateIndex
CREATE INDEX "NaoConformidade_registradaPorId_idx" ON "NaoConformidade"("registradaPorId");

-- CreateIndex
CREATE INDEX "NaoConformidade_status_idx" ON "NaoConformidade"("status");

-- CreateIndex
CREATE INDEX "NaoConformidade_severidade_idx" ON "NaoConformidade"("severidade");

-- CreateIndex
CREATE UNIQUE INDEX "OrdemServico_codigo_key" ON "OrdemServico"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "OrdemServico_naoConformidadeId_key" ON "OrdemServico"("naoConformidadeId");

-- CreateIndex
CREATE INDEX "OrdemServico_secretariaId_idx" ON "OrdemServico"("secretariaId");

-- CreateIndex
CREATE INDEX "OrdemServico_unidadeId_idx" ON "OrdemServico"("unidadeId");

-- CreateIndex
CREATE INDEX "OrdemServico_status_idx" ON "OrdemServico"("status");

-- CreateIndex
CREATE INDEX "OrdemServico_prioridade_idx" ON "OrdemServico"("prioridade");

-- CreateIndex
CREATE INDEX "OrdemServico_responsavelId_idx" ON "OrdemServico"("responsavelId");

-- CreateIndex
CREATE INDEX "OrdemServico_abertaEm_idx" ON "OrdemServico"("abertaEm");

-- CreateIndex
CREATE INDEX "HistoricoStatus_entidadeTipo_entidadeId_idx" ON "HistoricoStatus"("entidadeTipo", "entidadeId");

-- CreateIndex
CREATE INDEX "HistoricoStatus_alteradoPorId_idx" ON "HistoricoStatus"("alteradoPorId");

-- CreateIndex
CREATE INDEX "HistoricoStatus_createdAt_idx" ON "HistoricoStatus"("createdAt");

-- CreateIndex
CREATE INDEX "LogAuditoria_usuarioId_idx" ON "LogAuditoria"("usuarioId");

-- CreateIndex
CREATE INDEX "LogAuditoria_acao_idx" ON "LogAuditoria"("acao");

-- CreateIndex
CREATE INDEX "LogAuditoria_entidadeTipo_entidadeId_idx" ON "LogAuditoria"("entidadeTipo", "entidadeId");

-- CreateIndex
CREATE INDEX "LogAuditoria_createdAt_idx" ON "LogAuditoria"("createdAt");

-- CreateIndex
CREATE INDEX "LogAuditoria_correlationId_idx" ON "LogAuditoria"("correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "OfflineSyncEvent_clientEventId_key" ON "OfflineSyncEvent"("clientEventId");

-- CreateIndex
CREATE INDEX "OfflineSyncEvent_deviceId_idx" ON "OfflineSyncEvent"("deviceId");

-- CreateIndex
CREATE INDEX "OfflineSyncEvent_usuarioId_idx" ON "OfflineSyncEvent"("usuarioId");

-- CreateIndex
CREATE INDEX "OfflineSyncEvent_entidadeTipo_entidadeId_idx" ON "OfflineSyncEvent"("entidadeTipo", "entidadeId");

-- CreateIndex
CREATE INDEX "OfflineSyncEvent_status_idx" ON "OfflineSyncEvent"("status");

-- CreateIndex
CREATE INDEX "OfflineSyncEvent_recebidoEm_idx" ON "OfflineSyncEvent"("recebidoEm");

-- CreateIndex
CREATE INDEX "DashboardSnapshot_escopo_idx" ON "DashboardSnapshot"("escopo");

-- CreateIndex
CREATE INDEX "DashboardSnapshot_secretariaId_idx" ON "DashboardSnapshot"("secretariaId");

-- CreateIndex
CREATE INDEX "DashboardSnapshot_unidadeId_idx" ON "DashboardSnapshot"("unidadeId");

-- CreateIndex
CREATE INDEX "DashboardSnapshot_chave_idx" ON "DashboardSnapshot"("chave");

-- CreateIndex
CREATE INDEX "DashboardSnapshot_geradoEm_idx" ON "DashboardSnapshot"("geradoEm");

-- AddForeignKey
ALTER TABLE "UnidadePublica" ADD CONSTRAINT "UnidadePublica_secretariaId_fkey" FOREIGN KEY ("secretariaId") REFERENCES "Secretaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_secretariaId_fkey" FOREIGN KEY ("secretariaId") REFERENCES "Secretaria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioPerfil" ADD CONSTRAINT "UsuarioPerfil_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioPerfil" ADD CONSTRAINT "UsuarioPerfil_perfilId_fkey" FOREIGN KEY ("perfilId") REFERENCES "Perfil"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfilPermissao" ADD CONSTRAINT "PerfilPermissao_perfilId_fkey" FOREIGN KEY ("perfilId") REFERENCES "Perfil"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfilPermissao" ADD CONSTRAINT "PerfilPermissao_permissaoId_fkey" FOREIGN KEY ("permissaoId") REFERENCES "Permissao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checklist" ADD CONSTRAINT "Checklist_secretariaId_fkey" FOREIGN KEY ("secretariaId") REFERENCES "Secretaria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistVersao" ADD CONSTRAINT "ChecklistVersao_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "Checklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistVersao" ADD CONSTRAINT "ChecklistVersao_publicadoPorId_fkey" FOREIGN KEY ("publicadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_checklistVersaoId_fkey" FOREIGN KEY ("checklistVersaoId") REFERENCES "ChecklistVersao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fiscalizacao" ADD CONSTRAINT "Fiscalizacao_secretariaId_fkey" FOREIGN KEY ("secretariaId") REFERENCES "Secretaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fiscalizacao" ADD CONSTRAINT "Fiscalizacao_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "UnidadePublica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fiscalizacao" ADD CONSTRAINT "Fiscalizacao_checklistVersaoId_fkey" FOREIGN KEY ("checklistVersaoId") REFERENCES "ChecklistVersao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fiscalizacao" ADD CONSTRAINT "Fiscalizacao_agenteId_fkey" FOREIGN KEY ("agenteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RespostaChecklist" ADD CONSTRAINT "RespostaChecklist_fiscalizacaoId_fkey" FOREIGN KEY ("fiscalizacaoId") REFERENCES "Fiscalizacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RespostaChecklist" ADD CONSTRAINT "RespostaChecklist_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ChecklistItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidencia" ADD CONSTRAINT "Evidencia_fiscalizacaoId_fkey" FOREIGN KEY ("fiscalizacaoId") REFERENCES "Fiscalizacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidencia" ADD CONSTRAINT "Evidencia_respostaId_fkey" FOREIGN KEY ("respostaId") REFERENCES "RespostaChecklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidencia" ADD CONSTRAINT "Evidencia_naoConformidadeId_fkey" FOREIGN KEY ("naoConformidadeId") REFERENCES "NaoConformidade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidencia" ADD CONSTRAINT "Evidencia_ordemServicoId_fkey" FOREIGN KEY ("ordemServicoId") REFERENCES "OrdemServico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NaoConformidade" ADD CONSTRAINT "NaoConformidade_fiscalizacaoId_fkey" FOREIGN KEY ("fiscalizacaoId") REFERENCES "Fiscalizacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NaoConformidade" ADD CONSTRAINT "NaoConformidade_respostaId_fkey" FOREIGN KEY ("respostaId") REFERENCES "RespostaChecklist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NaoConformidade" ADD CONSTRAINT "NaoConformidade_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ChecklistItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NaoConformidade" ADD CONSTRAINT "NaoConformidade_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "UnidadePublica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NaoConformidade" ADD CONSTRAINT "NaoConformidade_registradaPorId_fkey" FOREIGN KEY ("registradaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdemServico" ADD CONSTRAINT "OrdemServico_secretariaId_fkey" FOREIGN KEY ("secretariaId") REFERENCES "Secretaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdemServico" ADD CONSTRAINT "OrdemServico_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "UnidadePublica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdemServico" ADD CONSTRAINT "OrdemServico_naoConformidadeId_fkey" FOREIGN KEY ("naoConformidadeId") REFERENCES "NaoConformidade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdemServico" ADD CONSTRAINT "OrdemServico_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdemServico" ADD CONSTRAINT "OrdemServico_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoStatus" ADD CONSTRAINT "HistoricoStatus_alteradoPorId_fkey" FOREIGN KEY ("alteradoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogAuditoria" ADD CONSTRAINT "LogAuditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfflineSyncEvent" ADD CONSTRAINT "OfflineSyncEvent_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardSnapshot" ADD CONSTRAINT "DashboardSnapshot_secretariaId_fkey" FOREIGN KEY ("secretariaId") REFERENCES "Secretaria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardSnapshot" ADD CONSTRAINT "DashboardSnapshot_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "UnidadePublica"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Geospatial generated columns and GiST indexes
ALTER TABLE "UnidadePublica"
  ADD CONSTRAINT "UnidadePublica_latitude_range_check" CHECK ("latitude" BETWEEN -90 AND 90),
  ADD CONSTRAINT "UnidadePublica_longitude_range_check" CHECK ("longitude" BETWEEN -180 AND 180),
  ADD COLUMN "localizacao" geography(Point, 4326)
    GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint("longitude"::double precision, "latitude"::double precision), 4326)::geography) STORED;

CREATE INDEX "UnidadePublica_localizacao_gist" ON "UnidadePublica" USING GIST ("localizacao");

ALTER TABLE "Fiscalizacao"
  ADD CONSTRAINT "Fiscalizacao_checkin_latitude_range_check" CHECK ("checkinLatitude" IS NULL OR "checkinLatitude" BETWEEN -90 AND 90),
  ADD CONSTRAINT "Fiscalizacao_checkin_longitude_range_check" CHECK ("checkinLongitude" IS NULL OR "checkinLongitude" BETWEEN -180 AND 180),
  ADD CONSTRAINT "Fiscalizacao_checkout_latitude_range_check" CHECK ("checkoutLatitude" IS NULL OR "checkoutLatitude" BETWEEN -90 AND 90),
  ADD CONSTRAINT "Fiscalizacao_checkout_longitude_range_check" CHECK ("checkoutLongitude" IS NULL OR "checkoutLongitude" BETWEEN -180 AND 180),
  ADD COLUMN "checkinLocalizacao" geography(Point, 4326)
    GENERATED ALWAYS AS (
      CASE
        WHEN "checkinLatitude" IS NULL OR "checkinLongitude" IS NULL THEN NULL
        ELSE ST_SetSRID(ST_MakePoint("checkinLongitude"::double precision, "checkinLatitude"::double precision), 4326)::geography
      END
    ) STORED,
  ADD COLUMN "checkoutLocalizacao" geography(Point, 4326)
    GENERATED ALWAYS AS (
      CASE
        WHEN "checkoutLatitude" IS NULL OR "checkoutLongitude" IS NULL THEN NULL
        ELSE ST_SetSRID(ST_MakePoint("checkoutLongitude"::double precision, "checkoutLatitude"::double precision), 4326)::geography
      END
    ) STORED;

CREATE INDEX "Fiscalizacao_checkinLocalizacao_gist" ON "Fiscalizacao" USING GIST ("checkinLocalizacao");
CREATE INDEX "Fiscalizacao_checkoutLocalizacao_gist" ON "Fiscalizacao" USING GIST ("checkoutLocalizacao");

ALTER TABLE "Evidencia"
  ADD CONSTRAINT "Evidencia_latitude_range_check" CHECK ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90),
  ADD CONSTRAINT "Evidencia_longitude_range_check" CHECK ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180),
  ADD COLUMN "localizacao" geography(Point, 4326)
    GENERATED ALWAYS AS (
      CASE
        WHEN "latitude" IS NULL OR "longitude" IS NULL THEN NULL
        ELSE ST_SetSRID(ST_MakePoint("longitude"::double precision, "latitude"::double precision), 4326)::geography
      END
    ) STORED;

CREATE INDEX "Evidencia_localizacao_gist" ON "Evidencia" USING GIST ("localizacao");

ALTER TABLE "NaoConformidade"
  ADD CONSTRAINT "NaoConformidade_latitude_range_check" CHECK ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90),
  ADD CONSTRAINT "NaoConformidade_longitude_range_check" CHECK ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180),
  ADD COLUMN "localizacao" geography(Point, 4326)
    GENERATED ALWAYS AS (
      CASE
        WHEN "latitude" IS NULL OR "longitude" IS NULL THEN NULL
        ELSE ST_SetSRID(ST_MakePoint("longitude"::double precision, "latitude"::double precision), 4326)::geography
      END
    ) STORED;

CREATE INDEX "NaoConformidade_localizacao_gist" ON "NaoConformidade" USING GIST ("localizacao");

