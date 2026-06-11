import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  ChamadoOrigem,
  ChamadoStatus,
  EvidenciaTipo,
  NaoConformidadeStatus,
  Prisma,
} from '@prisma/client';
import { JwtPayload } from '../auth/jwt';
import { IntegracoesService } from '../integracoes/integracoes.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateChamadoDto, PublicCreateChamadoDto, UpdateChamadoStatusDto, UpdateChamadoAtribuicaoDto, ChamadoExecucaoCheckinDto, ChamadoExecucaoConcluirDto, ChamadoExecucaoEvidenciaDto } from './chamados.dto';
import {
  assertValidChamadoTransition,
  buildChamadoCode,
  buildChamadoTitleFromNc,
  buildDefaultDeadlineFromSeverity,
  canUsuarioExecutarChamado,
  historicoHasExecucaoCheckin,
  isEvidenciaExecucaoCampo,
  parseExecucaoCheckinMetadata,
  priorityFromSeverity,
  shouldGenerateChamadoFromNc,
} from './chamados.rules';
import { validateMobileCheckin } from '../mobile/mobile.rules';

type Tx = Prisma.TransactionClient;

@Injectable()
export class ChamadosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integracoesService: IntegracoesService,
    private readonly storageService: StorageService,
  ) {}

  listChamados() {
    return this.prisma.chamado
      .findMany({
        orderBy: { createdAt: 'desc' },
        include: this.includeRelations(),
      })
      .then((items) => items.map((item) => this.serializeChamado(item)));
  }

  async listEmExecucaoPorEquipe(user: JwtPayload) {
    const onlyExecutor =
      !user.permissoes.includes('chamados.gerenciar') && user.permissoes.includes('chamados.executar');

    const chamados = await this.prisma.chamado.findMany({
      where: {
        status: ChamadoStatus.EM_EXECUCAO,
        ...(onlyExecutor
          ? { equipe: { membros: { some: { usuarioId: user.sub } } } }
          : {}),
      },
      orderBy: [{ equipe: { nome: 'asc' } }, { prioridade: 'desc' }, { createdAt: 'asc' }],
      include: this.includeRelations(),
    });

    const gruposMap = new Map<
      string,
      {
        equipe: { id: string; nome: string; secretaria?: { sigla: string } | null } | null;
        chamados: typeof chamados;
      }
    >();

    for (const chamado of chamados) {
      const key = chamado.equipeId ?? '__sem_equipe__';
      if (!gruposMap.has(key)) {
        gruposMap.set(key, {
          equipe: chamado.equipe
            ? {
                id: chamado.equipe.id,
                nome: chamado.equipe.nome,
                secretaria: chamado.secretaria ? { sigla: chamado.secretaria.sigla } : null,
              }
            : null,
          chamados: [],
        });
      }
      gruposMap.get(key)!.chamados.push(chamado);
    }

    const grupos = Array.from(gruposMap.values()).sort((a, b) => {
      if (!a.equipe) return 1;
      if (!b.equipe) return -1;
      return a.equipe.nome.localeCompare(b.equipe.nome, 'pt-BR');
    });

    return {
      total: chamados.length,
      grupos: grupos.map((grupo) => ({
        ...grupo,
        chamados: grupo.chamados.map((item) => this.serializeChamado(item)),
      })),
    };
  }

  listEquipesAtivas() {
    return this.prisma.equipe.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
      select: {
        id: true,
        nome: true,
        secretaria: { select: { id: true, sigla: true } },
        membros: {
          select: {
            usuario: { select: { id: true, nome: true, ativo: true } },
          },
        },
      },
    });
  }

  async getChamado(id: string) {
    const chamado = await this.getChamadoOrThrow(id);
    const historico = await this.prisma.historicoStatus.findMany({
      where: { entidadeTipo: 'Chamado', entidadeId: id },
      orderBy: { createdAt: 'asc' },
      include: { alteradoPor: { select: { id: true, nome: true } } },
    });
    return { ...this.serializeChamado(chamado), historico };
  }

  async getChamadoParaExecucao(id: string, user: JwtPayload) {
    const chamado = await this.getChamadoOrThrow(id);
    await this.assertUsuarioPodeExecutarChamado(chamado, user);
    if (chamado.status !== ChamadoStatus.EM_EXECUCAO) {
      throw new BadRequestException('Somente chamados em execução podem ser atendidos neste fluxo.');
    }

    const [historico, evidencias] = await Promise.all([
      this.prisma.historicoStatus.findMany({
        where: { entidadeTipo: 'Chamado', entidadeId: id },
        orderBy: { createdAt: 'asc' },
        include: { alteradoPor: { select: { id: true, nome: true } } },
      }),
      this.prisma.evidencia.findMany({
        where: { chamadoId: id },
        orderBy: { capturadaEm: 'asc' },
      }),
    ]);

    const execucaoCheckin = [...historico]
      .reverse()
      .find((item) => {
        const metadata = item.metadata as { tipo?: string } | null;
        return metadata?.tipo === 'execucao_checkin';
      });

    const unidade = await this.prisma.unidadePublica.findUnique({
      where: { id: chamado.unidadeId },
      select: {
        latitude: true,
        longitude: true,
        raioValidacaoMetros: true,
        endereco: true,
        bairro: true,
      },
    });

    return {
      ...this.serializeChamado(chamado),
      historico,
      evidencias: evidencias
        .filter((item) => isEvidenciaExecucaoCampo(item.metadata))
        .map((item) => this.serializeEvidencia(item)),
      execucaoCheckin: execucaoCheckin
        ? parseExecucaoCheckinMetadata(execucaoCheckin.metadata, execucaoCheckin.createdAt)
        : null,
      unidadeExecucao: unidade
        ? {
            latitude: Number(unidade.latitude),
            longitude: Number(unidade.longitude),
            raioValidacaoMetros: unidade.raioValidacaoMetros,
            endereco: unidade.endereco,
            bairro: unidade.bairro,
          }
        : null,
    };
  }

  async registrarCheckinExecucao(id: string, dto: ChamadoExecucaoCheckinDto, user: JwtPayload) {
    const chamado = await this.getChamadoOrThrow(id);
    await this.assertUsuarioPodeExecutarChamado(chamado, user);
    this.assertChamadoEmExecucao(chamado.status);

    const unidade = await this.prisma.unidadePublica.findUnique({
      where: { id: chamado.unidadeId },
      select: { latitude: true, longitude: true, raioValidacaoMetros: true },
    });
    if (!unidade) throw new NotFoundException('Unidade do chamado não encontrada.');

    const validation = validateMobileCheckin({
      unidade: {
        latitude: Number(unidade.latitude),
        longitude: Number(unidade.longitude),
        raioValidacaoMetros: unidade.raioValidacaoMetros,
      },
      checkin: dto.checkin,
    });

    if (!validation.valid) {
      throw new BadRequestException(validation.reasons.join('; '));
    }

    await this.prisma.historicoStatus.create({
      data: {
        entidadeTipo: 'Chamado',
        entidadeId: id,
        statusAnterior: chamado.status,
        statusNovo: chamado.status,
        motivo: 'Check-in de execução em campo.',
        alteradoPorId: user.sub,
        metadata: {
          tipo: 'execucao_checkin',
          latitude: dto.checkin.latitude,
          longitude: dto.checkin.longitude,
          precisaoMetros: dto.checkin.precisaoMetros,
          distanciaMetros: validation.result.distanceMeters,
          raioMetros: validation.result.radiusMeters,
        },
      },
    });

    return this.getChamadoParaExecucao(id, user);
  }

  async adicionarEvidenciaExecucao(id: string, dto: ChamadoExecucaoEvidenciaDto, user: JwtPayload) {
    const chamado = await this.getChamadoOrThrow(id);
    await this.assertUsuarioPodeExecutarChamado(chamado, user);
    this.assertChamadoEmExecucao(chamado.status);
    await this.assertCheckinExecucaoRegistrado(id);

    const stored = await this.storageService.persistEvidenceUrl(dto.url.trim(), dto.mimeType);
    const evidencia = await this.prisma.evidencia.create({
      data: {
        chamadoId: id,
        tipo: dto.tipo ?? EvidenciaTipo.FOTO,
        url: stored.url,
        storageKey: stored.storageKey,
        mimeType: stored.mimeType,
        tamanhoBytes: stored.tamanhoBytes,
        checksum: stored.checksum,
        latitude: dto.localizacao.latitude,
        longitude: dto.localizacao.longitude,
        precisaoMetros: dto.localizacao.precisaoMetros,
        capturadaEm: new Date(dto.capturadaEm),
        enviadaEm: new Date(),
        metadata: {
          origem: 'execucao_campo',
          ...(dto.descricao?.trim() ? { descricao: dto.descricao.trim() } : {}),
        },
      },
    });

    await this.prisma.logAuditoria.create({
      data: {
        usuarioId: user.sub,
        acao: AuditAction.UPDATE,
        entidadeTipo: 'Chamado',
        entidadeId: id,
        valorNovo: { evidenciaId: evidencia.id, tipo: 'execucao_evidencia' },
      },
    });

    return this.serializeEvidencia(evidencia);
  }

  async concluirExecucao(id: string, dto: ChamadoExecucaoConcluirDto, user: JwtPayload) {
    const before = await this.getChamadoOrThrow(id);
    await this.assertUsuarioPodeExecutarChamado(before, user);
    this.assertChamadoEmExecucao(before.status);
    await this.assertCheckinExecucaoRegistrado(id);

    const unidade = await this.prisma.unidadePublica.findUnique({
      where: { id: before.unidadeId },
      select: { latitude: true, longitude: true, raioValidacaoMetros: true },
    });
    if (!unidade) throw new NotFoundException('Unidade do chamado não encontrada.');

    const checkinValidation = validateMobileCheckin({
      unidade: {
        latitude: Number(unidade.latitude),
        longitude: Number(unidade.longitude),
        raioValidacaoMetros: unidade.raioValidacaoMetros,
      },
      checkin: dto.checkin,
    });

    if (!checkinValidation.valid) {
      throw new BadRequestException(checkinValidation.reasons.join('; '));
    }

    const evidenciasCount = await this.countEvidenciasExecucaoCampo(id);
    if (evidenciasCount < 1) {
      throw new BadRequestException('Registre ao menos uma evidência fotográfica da execução em campo.');
    }

    const nextStatus = dto.impedimento ? ChamadoStatus.IMPEDIDO : ChamadoStatus.CONCLUIDO;
    if (dto.impedimento && !dto.impedimentoMotivo?.trim()) {
      throw new BadRequestException('Informe o motivo do impedimento.');
    }

    try {
      assertValidChamadoTransition(before.status, nextStatus);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Transição inválida');
    }

    const chamado = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.chamado.update({
        where: { id },
        data: {
          status: nextStatus,
          impedimentoMotivo: dto.impedimento ? dto.impedimentoMotivo?.trim() : null,
          concluidoEm: nextStatus === ChamadoStatus.CONCLUIDO ? new Date() : before.concluidoEm,
          encerradoEm: nextStatus === ChamadoStatus.CONCLUIDO ? new Date() : before.encerradoEm,
        },
        include: this.includeRelations(),
      });

      await tx.historicoStatus.create({
        data: {
          entidadeTipo: 'Chamado',
          entidadeId: id,
          statusAnterior: before.status,
          statusNovo: nextStatus,
          motivo: dto.impedimento
            ? `Execução impedida: ${dto.impedimentoMotivo?.trim()}`
            : 'Execução concluída em campo.',
          alteradoPorId: user.sub,
          metadata: {
            tipo: 'execucao_conclusao',
            relatorio: dto.relatorio.trim(),
            checkin: {
              latitude: dto.checkin.latitude,
              longitude: dto.checkin.longitude,
              precisaoMetros: dto.checkin.precisaoMetros,
            },
            distanciaMetros: checkinValidation.result.distanceMeters,
            evidenciasCount,
          },
        },
      });

      await tx.logAuditoria.create({
        data: {
          usuarioId: user.sub,
          acao: AuditAction.STATUS_CHANGE,
          entidadeTipo: 'Chamado',
          entidadeId: id,
          valorAntigo: JSON.parse(JSON.stringify(before)) as Prisma.InputJsonValue,
          valorNovo: JSON.parse(JSON.stringify(updated)) as Prisma.InputJsonValue,
        },
      });

      return updated;
    });

    return this.serializeChamado(chamado);
  }

  async getUnidadePublicaByCodigo(codigoPatrimonial: string) {
    const unidade = await this.prisma.unidadePublica.findFirst({
      where: {
        codigoPatrimonial: codigoPatrimonial.trim().toUpperCase(),
        ativo: true,
      },
      select: {
        id: true,
        nome: true,
        codigoPatrimonial: true,
        tipo: true,
        endereco: true,
        bairro: true,
        latitude: true,
        longitude: true,
        secretaria: { select: { id: true, nome: true, sigla: true } },
      },
    });

    if (!unidade) throw new NotFoundException('Proprio publico nao encontrado para este QR Code.');
    return {
      ...unidade,
      latitude: Number(unidade.latitude),
      longitude: Number(unidade.longitude),
    };
  }

  async createChamado(dto: CreateChamadoDto, user: JwtPayload) {
    const unidade = await this.getActiveUnidadeOrThrow(dto.unidadeId);
    const sequence = (await this.prisma.chamado.count()) + 1;

    const chamado = await this.prisma.chamado.create({
      data: {
        codigo: buildChamadoCode(sequence),
        secretariaId: unidade.secretariaId,
        unidadeId: unidade.id,
        descricao: dto.descricao.trim(),
        prioridade: dto.prioridade,
        origem: dto.origem ?? ChamadoOrigem.INTERNO,
        solicitanteNome: dto.solicitanteNome?.trim(),
        solicitanteEmail: dto.solicitanteEmail?.trim().toLowerCase(),
        solicitanteTelefone: dto.solicitanteTelefone?.trim(),
        latitude: unidade.latitude,
        longitude: unidade.longitude,
        registradoPorId: user.sub,
      },
      include: this.includeRelations(),
    });

    await this.audit(user.sub, AuditAction.CREATE, chamado.id, null, chamado);

    await this.prisma.historicoStatus.create({
      data: {
        entidadeTipo: 'Chamado',
        entidadeId: chamado.id,
        statusNovo: ChamadoStatus.ABERTO,
        motivo: 'Chamado registrado.',
        alteradoPorId: user.sub,
      },
    });

    await this.integracoesService.notify('chamado.criado', { chamadoId: chamado.id, codigo: chamado.codigo }, user);

    return this.serializeChamado(chamado);
  }

  async createChamadoPublico(codigoPatrimonial: string, dto: PublicCreateChamadoDto) {
    const unidade = await this.prisma.unidadePublica.findFirst({
      where: { codigoPatrimonial: codigoPatrimonial.trim().toUpperCase(), ativo: true },
    });
    if (!unidade) throw new NotFoundException('QR Code invalido ou proprio inativo.');

    let fotoUrl: string | undefined;
    let fotoMimeType: string | undefined;
    if (dto.fotoDataUrl?.trim()) {
      const stored = await this.storageService.persistEvidenceUrl(dto.fotoDataUrl.trim());
      fotoUrl = stored.url;
      fotoMimeType = stored.mimeType;
    }

    const sequence = (await this.prisma.chamado.count()) + 1;
    const chamado = await this.prisma.chamado.create({
      data: {
        codigo: buildChamadoCode(sequence),
        secretariaId: unidade.secretariaId,
        unidadeId: unidade.id,
        descricao: dto.descricao.trim(),
        origem: ChamadoOrigem.QR_CODE,
        solicitanteNome: dto.solicitanteNome?.trim(),
        solicitanteEmail: dto.solicitanteEmail?.trim().toLowerCase(),
        solicitanteTelefone: dto.solicitanteTelefone?.trim(),
        latitude: unidade.latitude,
        longitude: unidade.longitude,
        fotoUrl,
        fotoMimeType,
      },
      include: this.includeRelations(),
    });

    await this.prisma.logAuditoria.create({
      data: {
        acao: AuditAction.CREATE,
        entidadeTipo: 'Chamado',
        entidadeId: chamado.id,
        valorNovo: { origem: 'QR_CODE', codigo: chamado.codigo },
      },
    });

    await this.prisma.historicoStatus.create({
      data: {
        entidadeTipo: 'Chamado',
        entidadeId: chamado.id,
        statusNovo: ChamadoStatus.ABERTO,
        motivo: 'Chamado aberto via QR Code.',
      },
    });

    await this.integracoesService.notifySystem('chamado.qr.criado', {
      chamadoId: chamado.id,
      codigo: chamado.codigo,
      unidadeId: unidade.id,
      secretariaId: unidade.secretariaId,
    });

    return this.serializeChamado(chamado);
  }

  async updateStatus(id: string, dto: UpdateChamadoStatusDto, user: JwtPayload) {
    const before = await this.getChamadoOrThrow(id);

    try {
      assertValidChamadoTransition(before.status, dto.status);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Transição inválida');
    }

    if (dto.equipeId) {
      await this.ensureEquipeAtiva(dto.equipeId);
    }

    const nextEquipeId = dto.equipeId !== undefined ? dto.equipeId || null : before.equipeId;
    if (dto.status === ChamadoStatus.EM_EXECUCAO && !nextEquipeId) {
      throw new BadRequestException('Informe uma equipe antes de mover o chamado para Em execução.');
    }

    const isTerminal = (status: ChamadoStatus) =>
      status === ChamadoStatus.CONCLUIDO || status === ChamadoStatus.CANCELADO;

    const chamado = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.chamado.update({
        where: { id },
        data: {
          status: dto.status,
          responsavelId: dto.responsavelId ?? before.responsavelId,
          equipeId: nextEquipeId,
          impedimentoMotivo:
            dto.status === ChamadoStatus.IMPEDIDO
              ? (dto.impedimentoMotivo ?? before.impedimentoMotivo)
              : null,
          concluidoEm:
            dto.status === ChamadoStatus.CONCLUIDO
              ? (before.concluidoEm ?? new Date())
              : isTerminal(before.status) && !isTerminal(dto.status)
                ? null
                : before.concluidoEm,
          encerradoEm: isTerminal(dto.status)
            ? (before.encerradoEm ?? new Date())
            : isTerminal(before.status) && !isTerminal(dto.status)
              ? null
              : before.encerradoEm,
        },
        include: this.includeRelations(),
      });

      await tx.historicoStatus.create({
        data: {
          entidadeTipo: 'Chamado',
          entidadeId: id,
          statusAnterior: before.status,
          statusNovo: dto.status,
          motivo: dto.motivo ?? 'Atualização de status do chamado.',
          alteradoPorId: user.sub,
          metadata: {
            responsavelId: dto.responsavelId ?? before.responsavelId,
            impedimentoMotivo: dto.impedimentoMotivo,
          },
        },
      });

      await tx.logAuditoria.create({
        data: {
          usuarioId: user.sub,
          acao: AuditAction.STATUS_CHANGE,
          entidadeTipo: 'Chamado',
          entidadeId: id,
          valorAntigo: JSON.parse(JSON.stringify(before)) as Prisma.InputJsonValue,
          valorNovo: JSON.parse(JSON.stringify(updated)) as Prisma.InputJsonValue,
        },
      });

      return updated;
    });

    return this.serializeChamado(chamado);
  }

  async updateAtribuicao(id: string, dto: UpdateChamadoAtribuicaoDto, user: JwtPayload) {
    const before = await this.getChamadoOrThrow(id);
    const equipeId = dto.equipeId === undefined ? before.equipeId : dto.equipeId || null;
    let responsavelId = dto.responsavelId === undefined ? before.responsavelId : dto.responsavelId || null;
    if (!equipeId) responsavelId = null;

    if (equipeId) {
      await this.ensureEquipeAtiva(equipeId);
    }

    if (responsavelId && equipeId) {
      await this.ensureUsuarioNaEquipe(responsavelId, equipeId);
    }

    if (equipeId === before.equipeId && responsavelId === before.responsavelId) {
      return this.serializeChamado(before);
    }

    const chamado = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.chamado.update({
        where: { id },
        data: { equipeId, responsavelId },
        include: this.includeRelations(),
      });

      await tx.historicoStatus.create({
        data: {
          entidadeTipo: 'Chamado',
          entidadeId: id,
          statusAnterior: before.status,
          statusNovo: before.status,
          motivo: dto.motivo ?? 'Atribuição de equipe/responsável atualizada.',
          alteradoPorId: user.sub,
          metadata: {
            equipeId,
            responsavelId,
            equipeAnteriorId: before.equipeId,
            responsavelAnteriorId: before.responsavelId,
          },
        },
      });

      await tx.logAuditoria.create({
        data: {
          usuarioId: user.sub,
          acao: AuditAction.UPDATE,
          entidadeTipo: 'Chamado',
          entidadeId: id,
          valorAntigo: JSON.parse(JSON.stringify(before)) as Prisma.InputJsonValue,
          valorNovo: JSON.parse(JSON.stringify(updated)) as Prisma.InputJsonValue,
        },
      });

      return updated;
    });

    return this.serializeChamado(chamado);
  }

  async generateForNaoConformidade(naoConformidadeId: string, user: JwtPayload) {
    return this.prisma.$transaction((tx) => this.generateForNaoConformidadeTx(tx, naoConformidadeId, user.sub));
  }

  async generateForNaoConformidadeTx(tx: Tx, naoConformidadeId: string, usuarioId: string) {
    const naoConformidade = await tx.naoConformidade.findUnique({
      where: { id: naoConformidadeId },
      include: {
        chamado: true,
        item: true,
        fiscalizacao: true,
        unidade: true,
        evidencias: true,
      },
    });

    if (!naoConformidade) {
      throw new NotFoundException('Não conformidade não encontrada');
    }

    if (!shouldGenerateChamadoFromNc({ naoConformidadeId, chamadoId: naoConformidade.chamado?.id })) {
      return naoConformidade.chamado;
    }

    const sequence = (await tx.chamado.count()) + 1;
    const chamado = await tx.chamado.create({
      data: {
        codigo: buildChamadoCode(sequence),
        secretariaId: naoConformidade.fiscalizacao.secretariaId,
        unidadeId: naoConformidade.unidadeId,
        naoConformidadeId: naoConformidade.id,
        titulo: buildChamadoTitleFromNc(naoConformidade.item.titulo),
        descricao: naoConformidade.descricao,
        origem: ChamadoOrigem.FISCALIZACAO,
        prioridade: priorityFromSeverity(naoConformidade.severidade),
        status: ChamadoStatus.ABERTO,
        prazoEm: buildDefaultDeadlineFromSeverity(naoConformidade.severidade),
        registradoPorId: usuarioId,
      },
      include: this.includeRelations(),
    });

    await tx.naoConformidade.update({
      where: { id: naoConformidade.id },
      data: { status: NaoConformidadeStatus.CHAMADO_GERADO },
    });

    await tx.evidencia.updateMany({
      where: { naoConformidadeId: naoConformidade.id },
      data: { chamadoId: chamado.id },
    });

    await tx.historicoStatus.create({
      data: {
        entidadeTipo: 'Chamado',
        entidadeId: chamado.id,
        statusNovo: ChamadoStatus.ABERTO,
        motivo: 'Chamado criado automaticamente a partir de não conformidade.',
        alteradoPorId: usuarioId,
        metadata: {
          naoConformidadeId: naoConformidade.id,
          fiscalizacaoId: naoConformidade.fiscalizacaoId,
        },
      },
    });

    await tx.logAuditoria.create({
      data: {
        usuarioId,
        acao: AuditAction.CREATE,
        entidadeTipo: 'Chamado',
        entidadeId: chamado.id,
        valorNovo: JSON.parse(JSON.stringify(chamado)) as Prisma.InputJsonValue,
      },
    });

    return chamado;
  }

  private async getActiveUnidadeOrThrow(unidadeId: string) {
    const unidade = await this.prisma.unidadePublica.findFirst({
      where: { id: unidadeId, ativo: true },
    });
    if (!unidade) throw new NotFoundException('Unidade nao encontrada.');
    return unidade;
  }

  private async getChamadoOrThrow(id: string) {
    const chamado = await this.prisma.chamado.findUnique({
      where: { id },
      include: this.includeRelations(),
    });
    if (!chamado) throw new NotFoundException('Chamado nao encontrado.');
    return chamado;
  }

  private includeRelations() {
    return {
      secretaria: { select: { id: true, nome: true, sigla: true } },
      unidade: {
        select: {
          id: true,
          nome: true,
          codigoPatrimonial: true,
          endereco: true,
          bairro: true,
          latitude: true,
          longitude: true,
          raioValidacaoMetros: true,
        },
      },
      responsavel: { select: { id: true, nome: true } },
      equipe: { select: { id: true, nome: true } },
      registradoPor: { select: { id: true, nome: true } },
      naoConformidade: {
        select: {
          id: true,
          descricao: true,
          severidade: true,
          status: true,
          item: { select: { codigo: true, titulo: true } },
        },
      },
    };
  }

  private async assertUsuarioPodeExecutarChamado(
    chamado: { equipeId: string | null },
    user: JwtPayload,
  ) {
    if (user.permissoes.includes('chamados.gerenciar')) {
      return;
    }

    if (!user.permissoes.includes('chamados.executar')) {
      throw new ForbiddenException('Seu perfil não pode executar chamados em campo.');
    }

    if (!chamado.equipeId) {
      throw new ForbiddenException('Chamado sem equipe atribuída.');
    }

    const membros = await this.prisma.equipeUsuario.findMany({
      where: { equipeId: chamado.equipeId },
      select: { usuarioId: true },
    });

    if (
      !canUsuarioExecutarChamado(
        user.permissoes,
        user.sub,
        chamado,
        membros.map((item) => item.usuarioId),
      )
    ) {
      throw new ForbiddenException('Você não faz parte da equipe deste chamado.');
    }
  }

  private assertChamadoEmExecucao(status: ChamadoStatus) {
    if (status !== ChamadoStatus.EM_EXECUCAO) {
      throw new BadRequestException('Somente chamados em execução podem ser atendidos neste fluxo.');
    }
  }

  private async assertCheckinExecucaoRegistrado(chamadoId: string) {
    const historico = await this.prisma.historicoStatus.findMany({
      where: { entidadeTipo: 'Chamado', entidadeId: chamadoId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { metadata: true },
    });

    if (!historicoHasExecucaoCheckin(historico)) {
      throw new BadRequestException('Confirme o check-in no local antes de continuar a execução.');
    }
  }

  private async countEvidenciasExecucaoCampo(chamadoId: string) {
    const evidencias = await this.prisma.evidencia.findMany({
      where: { chamadoId },
      select: { metadata: true },
    });

    return evidencias.filter((item) => isEvidenciaExecucaoCampo(item.metadata)).length;
  }

  private serializeChamado<T extends {
    latitude?: unknown;
    longitude?: unknown;
    unidade?: {
      latitude?: unknown;
      longitude?: unknown;
      raioValidacaoMetros?: number;
    } | null;
  }>(chamado: T) {
    return {
      ...chamado,
      latitude: chamado.latitude != null ? Number(chamado.latitude) : null,
      longitude: chamado.longitude != null ? Number(chamado.longitude) : null,
      unidade: chamado.unidade
        ? {
            ...chamado.unidade,
            latitude: chamado.unidade.latitude != null ? Number(chamado.unidade.latitude) : null,
            longitude: chamado.unidade.longitude != null ? Number(chamado.unidade.longitude) : null,
          }
        : chamado.unidade,
    };
  }

  private serializeEvidencia(evidencia: {
    id: string;
    tipo: EvidenciaTipo;
    url: string;
    mimeType: string | null;
    tamanhoBytes: number | null;
    latitude: unknown;
    longitude: unknown;
    precisaoMetros: unknown;
    capturadaEm: Date;
    metadata: unknown;
  }) {
    return {
      id: evidencia.id,
      tipo: evidencia.tipo,
      url: evidencia.url,
      mimeType: evidencia.mimeType,
      tamanhoBytes: evidencia.tamanhoBytes,
      latitude: evidencia.latitude != null ? Number(evidencia.latitude) : null,
      longitude: evidencia.longitude != null ? Number(evidencia.longitude) : null,
      precisaoMetros: evidencia.precisaoMetros != null ? Number(evidencia.precisaoMetros) : null,
      capturadaEm: evidencia.capturadaEm.toISOString(),
      descricao:
        evidencia.metadata && typeof evidencia.metadata === 'object' && evidencia.metadata !== null && 'descricao' in evidencia.metadata
          ? String((evidencia.metadata as { descricao?: string }).descricao ?? '')
          : null,
    };
  }

  private async ensureEquipeAtiva(equipeId: string) {
    const equipe = await this.prisma.equipe.findFirst({ where: { id: equipeId, ativo: true } });
    if (!equipe) throw new BadRequestException('Equipe nao encontrada ou inativa.');
  }

  private async ensureUsuarioNaEquipe(usuarioId: string, equipeId: string) {
    const membership = await this.prisma.equipeUsuario.findUnique({
      where: { equipeId_usuarioId: { equipeId, usuarioId } },
    });
    if (!membership) {
      throw new BadRequestException('Responsavel informado nao pertence a equipe selecionada.');
    }
  }

  private audit(usuarioId: string, acao: AuditAction, entidadeId: string, antes: unknown, depois: unknown) {
    return this.prisma.logAuditoria.create({
      data: {
        usuarioId,
        acao,
        entidadeTipo: 'Chamado',
        entidadeId,
        valorAntigo: antes ? JSON.parse(JSON.stringify(antes)) : undefined,
        valorNovo: JSON.parse(JSON.stringify(depois)),
      },
    });
  }
}
