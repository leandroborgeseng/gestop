import { BadRequestException, ForbiddenException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  ChamadoModoLocalizacao,
  ChamadoOrigem,
  ChamadoStatus,
  EvidenciaTipo,
  NaoConformidadeStatus,
  Prisma,
} from '@prisma/client';
import { JwtPayload } from '../auth/jwt';
import {
  assertChamadoSecretariaAccess,
  resolveChamadoSecretariaFilter,
  resolveEquipeSecretariaFilter,
  resolveSecretariaScopeId,
} from '../auth/secretaria-scope';
import { IntegracoesService } from '../integracoes/integracoes.service';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { extractStorageKeyFromUrl, resolveStoragePublicUrl } from '../storage/storage-url';
import {
  CreateChamadoDto,
  PublicCreateChamadoDto,
  UpdateChamadoStatusDto,
  UpdateChamadoAtribuicaoDto,
  UpdateChamadoPlanejamentoDto,
  UpdateChamadoTriagemDto,
  RegistrarChamadoHistoricoDto,
  EmitirOrdensServicoDto,
  ChamadoExecucaoCheckinDto,
  ChamadoExecucaoConcluirDto,
  ChamadoExecucaoEvidenciaDto,
} from './chamados.dto';
import { buildOrdensServicoLotePdf } from './chamados-os-pdf';
import { sendChamadoEquipeNotificacao } from './chamados-notificacao';
import { buildPlanejamentoAlteracoes, buildTriagemAlteracoes, calcularPrazoSla, formatDateBr } from './chamados-sla';
import {
  assertValidChamadoTransition,
  buildChamadoCode,
  buildChamadoTitleFromNc,
  buildDefaultDeadlineFromSeverity,
  canUsuarioExecutarChamado,
  isEvidenciaExecucaoCampo,
  parseExecucaoCheckinMetadata,
  priorityFromSeverity,
  shouldGenerateChamadoFromNc,
} from './chamados.rules';
import { validateMobileCheckin } from '../mobile/mobile.rules';
import { parseDateKey, todayDateKey, utcDateKeyFromDate } from '../common/date.utils';
import { DEFAULT_RAIO_VALIDACAO_METROS } from '../domain/constants';

type Tx = Prisma.TransactionClient;

@Injectable()
export class ChamadosService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => IntegracoesService))
    private readonly integracoesService: IntegracoesService,
    private readonly storageService: StorageService,
    private readonly emailService: EmailService,
  ) {}

  async listChamados(params: { limit?: number; offset?: number } | undefined, user: JwtPayload) {
    const limit = Math.min(Math.max(params?.limit ?? 50, 1), 2000);
    const offset = Math.max(params?.offset ?? 0, 0);
    const where = resolveChamadoSecretariaFilter(user);

    const [items, total] = await Promise.all([
      this.prisma.chamado.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: this.includeRelations(),
      }),
      this.prisma.chamado.count({ where }),
    ]);

    return {
      items: items.map((item) => this.serializeChamado(item)),
      total,
      limit,
      offset,
      hasMore: offset + items.length < total,
    };
  }

  async listEmExecucaoPorEquipe(
    user: JwtPayload,
    filters?: { programacaoFrom?: string; programacaoTo?: string; hoje?: boolean },
  ) {
    const canGerenciar = user.permissoes.includes('chamados.gerenciar');
    const onlyExecutor = !canGerenciar && user.permissoes.includes('chamados.executar');

    const programacaoFilter = this.buildProgramacaoDateFilter(filters);

    const chamados = await this.prisma.chamado.findMany({
      where: {
        status: ChamadoStatus.EM_EXECUCAO,
        ...programacaoFilter,
        ...(onlyExecutor
          ? { equipe: { membros: { some: { usuarioId: user.sub } } } }
          : resolveChamadoSecretariaFilter(user)),
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

  async listEquipesAtivas(user: JwtPayload) {
    return this.prisma.equipe.findMany({
      where: { ativo: true, ...resolveEquipeSecretariaFilter(user) },
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

  async listEquipesParaExecucao(user: JwtPayload) {
    const canGerenciar = user.permissoes.includes('chamados.gerenciar');
    const onlyExecutor = !canGerenciar && user.permissoes.includes('chamados.executar');

    return this.prisma.equipe.findMany({
      where: {
        ativo: true,
        ...(onlyExecutor
          ? { membros: { some: { usuarioId: user.sub } } }
          : resolveEquipeSecretariaFilter(user)),
      },
      orderBy: { nome: 'asc' },
      select: {
        id: true,
        nome: true,
        secretaria: { select: { id: true, sigla: true } },
      },
    });
  }

  async listProgramacao(from: string, to: string, user: JwtPayload, equipeId?: string) {
    if (!from?.trim() || !to?.trim()) {
      throw new BadRequestException('Informe o intervalo from e to (YYYY-MM-DD).');
    }

    const fromKey = from.trim();
    const toKey = to.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fromKey) || !/^\d{4}-\d{2}-\d{2}$/.test(toKey)) {
      throw new BadRequestException('Datas devem estar no formato YYYY-MM-DD.');
    }

    const fromDate = parseDateKey(fromKey);
    const toDate = new Date(`${toKey}T23:59:59.999Z`);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || fromDate > toDate) {
      throw new BadRequestException('Intervalo de datas inválido.');
    }

    const rangeDays = (toDate.getTime() - fromDate.getTime()) / 86_400_000;
    if (rangeDays > 120) {
      throw new BadRequestException('Intervalo máximo de 120 dias.');
    }

    const statusAtivos = {
      notIn: [ChamadoStatus.CONCLUIDO, ChamadoStatus.CANCELADO] as ChamadoStatus[],
    };

    const equipeFilter =
      equipeId === 'sem-equipe'
        ? { equipeId: null }
        : equipeId?.trim()
          ? { equipeId: equipeId.trim() }
          : {};

    const secretariaFilter = resolveChamadoSecretariaFilter(user);

    const pendentesWhere = {
      status: statusAtivos,
      previstaExecucaoEm: null,
      ...secretariaFilter,
      ...equipeFilter,
    };

    const [programados, pendentes, totalPendentes] = await Promise.all([
      this.prisma.chamado.findMany({
        where: {
          status: statusAtivos,
          previstaExecucaoEm: { gte: fromDate, lte: toDate },
          ...secretariaFilter,
          ...equipeFilter,
        },
        orderBy: [{ previstaExecucaoEm: 'asc' }, { prioridade: 'desc' }, { createdAt: 'asc' }],
        take: 2000,
        include: this.includeRelations(),
      }),
      this.prisma.chamado.findMany({
        where: pendentesWhere,
        orderBy: [{ prioridade: 'desc' }, { createdAt: 'asc' }],
        take: 500,
        include: this.includeRelations(),
      }),
      this.prisma.chamado.count({ where: pendentesWhere }),
    ]);

    const porDiaMap = new Map<string, typeof programados>();
    for (const chamado of programados) {
      if (!chamado.previstaExecucaoEm) continue;
      const key = utcDateKeyFromDate(chamado.previstaExecucaoEm);
      if (!porDiaMap.has(key)) porDiaMap.set(key, []);
      porDiaMap.get(key)!.push(chamado);
    }

    const porDia = Array.from(porDiaMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, items]) => ({
        data,
        chamados: items.map((item) => this.serializeChamado(item)),
      }));

    return {
      from: fromKey,
      to: toKey,
      equipeId: equipeId?.trim() || null,
      totalProgramados: programados.length,
      totalPendentes,
      pendentesTruncados: totalPendentes > pendentes.length,
      pendentes: pendentes.map((item) => this.serializeChamado(item)),
      porDia,
    };
  }

  async getChamado(id: string, user: JwtPayload) {
    const chamado = await this.getChamadoOrThrow(id);
    assertChamadoSecretariaAccess(user, chamado);
    const historico = await this.prisma.historicoStatus.findMany({
      where: { entidadeTipo: 'Chamado', entidadeId: id },
      orderBy: { createdAt: 'asc' },
      include: { alteradoPor: { select: { id: true, nome: true } } },
    });
    return { ...this.serializeChamado(chamado), historico: await this.enrichHistorico(historico, id) };
  }

  async listTiposChamadoAtivos() {
    return this.prisma.tipoChamado.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
    });
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

    const unidadeExec = await this.resolveUnidadeExecucao(chamado);

    return {
      ...this.serializeChamado(chamado),
      historico,
      evidencias: evidencias
        .filter((item) => isEvidenciaExecucaoCampo(item.metadata))
        .map((item) => this.serializeEvidencia(item)),
      execucaoCheckin: execucaoCheckin
        ? parseExecucaoCheckinMetadata(execucaoCheckin.metadata, execucaoCheckin.createdAt)
        : null,
      unidadeExecucao: unidadeExec,
    };
  }

  async registrarCheckinExecucao(id: string, dto: ChamadoExecucaoCheckinDto, user: JwtPayload) {
    const chamado = await this.getChamadoOrThrow(id);
    await this.assertUsuarioPodeExecutarChamado(chamado, user);
    this.assertChamadoEmExecucao(chamado.status);

    const existingCheckin = await this.findExecucaoCheckinHistorico(id);
    if (existingCheckin) {
      return this.getChamadoParaExecucao(id, user);
    }

    const checkinTarget = await this.resolveCheckinTarget(chamado);
    if (!checkinTarget) throw new BadRequestException('Chamado sem localização para validar check-in.');

    const validation = validateMobileCheckin({
      unidade: checkinTarget,
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

    let stored: Awaited<ReturnType<StorageService['persistEvidenceUrl']>> | null = null;
    try {
      stored = await this.storageService.persistEvidenceUrl(dto.url.trim(), dto.mimeType);
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
    } catch (error) {
      if (stored?.storageKey) {
        await this.storageService.deleteStoredObject(stored.storageKey);
      }
      throw error;
    }
  }

  async concluirExecucao(id: string, dto: ChamadoExecucaoConcluirDto, user: JwtPayload) {
    const before = await this.getChamadoOrThrow(id);
    await this.assertUsuarioPodeExecutarChamado(before, user);
    this.assertChamadoEmExecucao(before.status);
    await this.assertCheckinExecucaoRegistrado(id);

    const checkinTarget = await this.resolveCheckinTarget(before);
    if (!checkinTarget) throw new BadRequestException('Chamado sem localização para validar check-in.');

    const checkinValidation = validateMobileCheckin({
      unidade: checkinTarget,
      checkin: dto.checkin,
    });

    if (!checkinValidation.valid) {
      throw new BadRequestException(checkinValidation.reasons.join('; '));
    }

    const checkinInicial = await this.findExecucaoCheckinHistorico(id);
    if (checkinInicial && this.coordsAreEqual(checkinInicial, dto.checkin)) {
      throw new BadRequestException('Confirme a conclusão com uma nova leitura de GPS no local.');
    }

    const evidenciasExecucao = await this.listEvidenciasExecucaoCampo(id);
    const evidenciasCount = evidenciasExecucao.length;
    if (!dto.impedimento && evidenciasCount < 1) {
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
            impedimento: Boolean(dto.impedimento),
            impedimentoMotivo: dto.impedimento ? dto.impedimentoMotivo?.trim() ?? null : null,
            checkin: {
              latitude: dto.checkin.latitude,
              longitude: dto.checkin.longitude,
              precisaoMetros: dto.checkin.precisaoMetros,
            },
            distanciaMetros: checkinValidation.result.distanceMeters,
            evidenciasCount,
            evidenciaIds: evidenciasExecucao.map((item) => item.id),
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

  async getChamadoPublicoPorProtocolo(codigo: string) {
    const normalized = codigo.trim().toUpperCase();
    if (normalized.length < 4) {
      throw new BadRequestException('Informe um protocolo valido.');
    }

    const chamado = await this.prisma.chamado.findFirst({
      where: { codigo: normalized },
      select: {
        id: true,
        codigo: true,
        status: true,
        descricao: true,
        prioridade: true,
        createdAt: true,
        encerradoEm: true,
        concluidoEm: true,
        enderecoTexto: true,
        enderecoBairro: true,
        unidade: { select: { nome: true, codigoPatrimonial: true } },
        secretaria: { select: { sigla: true, nome: true } },
      },
    });

    if (!chamado) throw new NotFoundException('Protocolo nao encontrado.');

    const historico = await this.prisma.historicoStatus.findMany({
      where: { entidadeTipo: 'Chamado', entidadeId: chamado.id },
      orderBy: { createdAt: 'asc' },
      select: {
        statusNovo: true,
        motivo: true,
        createdAt: true,
      },
    });

    return {
      codigo: chamado.codigo,
      status: chamado.status,
      prioridade: chamado.prioridade,
      descricaoResumo: chamado.descricao.length > 160 ? `${chamado.descricao.slice(0, 157)}...` : chamado.descricao,
      local: chamado.unidade?.nome ?? chamado.enderecoTexto ?? null,
      bairro: chamado.unidade ? null : chamado.enderecoBairro,
      secretaria: chamado.secretaria ? `${chamado.secretaria.sigla} — ${chamado.secretaria.nome}` : null,
      abertoEm: chamado.createdAt.toISOString(),
      encerradoEm: chamado.encerradoEm?.toISOString() ?? chamado.concluidoEm?.toISOString() ?? null,
      historico: historico.map((item) => ({
        status: item.statusNovo,
        motivo: item.motivo,
        em: item.createdAt.toISOString(),
      })),
    };
  }

  private async nextChamadoSequence(tx?: Tx): Promise<number> {
    const year = new Date().getFullYear();
    const client = tx ?? this.prisma;
    const rows = await client.$queryRaw<Array<{ ultimo: number }>>`
      INSERT INTO "ChamadoSequencia" ("ano", "ultimo")
      VALUES (${year}, 1)
      ON CONFLICT ("ano") DO UPDATE SET "ultimo" = "ChamadoSequencia"."ultimo" + 1
      RETURNING "ultimo"
    `;
    return Number(rows[0]?.ultimo ?? 1);
  }

  async createChamado(dto: CreateChamadoDto, user: JwtPayload) {
    const location = await this.resolveCreateLocation(dto, user.sub);
    const scopeId = resolveSecretariaScopeId(user);
    if (scopeId && location.secretariaId !== scopeId) {
      throw new ForbiddenException('Nao e permitido abrir chamado fora da sua secretaria.');
    }

    let fotoStorageKey: string | undefined;
    let fotoUrl: string | undefined;
    let fotoMimeType: string | undefined;
    if (dto.fotoDataUrl?.trim()) {
      const stored = await this.storageService.persistEvidenceUrl(dto.fotoDataUrl.trim());
      fotoStorageKey = stored.storageKey;
      fotoUrl = stored.url;
      fotoMimeType = stored.mimeType;
    }

    const chamado = await this.prisma.$transaction(async (tx) => {
      const sequence = await this.nextChamadoSequence(tx);
      return tx.chamado.create({
        data: {
          codigo: buildChamadoCode(sequence),
          secretariaId: location.secretariaId,
          unidadeId: location.unidadeId,
          modoLocalizacao: dto.modoLocalizacao,
          enderecoTexto: location.enderecoTexto,
          enderecoBairro: location.enderecoBairro,
          descricao: dto.descricao.trim(),
          prioridade: dto.prioridade,
          origem: dto.origem ?? ChamadoOrigem.INTERNO,
          solicitanteNome: dto.solicitanteNome?.trim(),
          solicitanteEmail: dto.solicitanteEmail?.trim().toLowerCase(),
          solicitanteTelefone: dto.solicitanteTelefone?.trim(),
          latitude: location.latitude,
          longitude: location.longitude,
          fotoUrl,
          fotoStorageKey,
          fotoMimeType,
          registradoPorId: user.sub,
        },
        include: this.includeRelations(),
      });
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

    let fotoStorageKey: string | undefined;
    let fotoUrl: string | undefined;
    let fotoMimeType: string | undefined;
    if (dto.fotoDataUrl?.trim()) {
      const stored = await this.storageService.persistEvidenceUrl(dto.fotoDataUrl.trim());
      fotoStorageKey = stored.storageKey;
      fotoUrl = stored.url;
      fotoMimeType = stored.mimeType;
    }

    const chamado = await this.prisma.$transaction(async (tx) => {
      const sequence = await this.nextChamadoSequence(tx);
      return tx.chamado.create({
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
          fotoStorageKey,
          fotoMimeType,
        },
        include: this.includeRelations(),
      });
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
    assertChamadoSecretariaAccess(user, before);

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
    assertChamadoSecretariaAccess(user, before);
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

  async updatePlanejamento(id: string, dto: UpdateChamadoPlanejamentoDto, user: JwtPayload) {
    const before = await this.getChamadoOrThrow(id);
    assertChamadoSecretariaAccess(user, before);

    if (before.status === ChamadoStatus.CONCLUIDO || before.status === ChamadoStatus.CANCELADO) {
      throw new BadRequestException('Chamados concluídos ou cancelados não podem ser reprogramados.');
    }

    const previstaExecucaoEm =
      dto.previstaExecucaoEm === undefined
        ? before.previstaExecucaoEm
        : dto.previstaExecucaoEm
          ? new Date(dto.previstaExecucaoEm)
          : null;

    if (previstaExecucaoEm && Number.isNaN(previstaExecucaoEm.getTime())) {
      throw new BadRequestException('Data prevista inválida.');
    }

    if (previstaExecucaoEm) {
      const previstaKey = utcDateKeyFromDate(previstaExecucaoEm);
      if (previstaKey < todayDateKey()) {
        throw new BadRequestException('A data prevista não pode ser no passado.');
      }
    }

    let equipeId = before.equipeId;
    if (dto.equipeId !== undefined) {
      equipeId = dto.equipeId?.trim() ? dto.equipeId.trim() : null;
      if (equipeId) {
        await this.ensureEquipeAtiva(equipeId);
      }
    }

    let prioridade = before.prioridade;
    if (dto.prioridade !== undefined) {
      prioridade = dto.prioridade;
    }

    const scheduling = dto.previstaExecucaoEm !== undefined && previstaExecucaoEm !== null;
    if (scheduling && !equipeId) {
      throw new BadRequestException('Informe a equipe ao programar a execução.');
    }

    let responsavelId = before.responsavelId;
    if (dto.equipeId !== undefined && equipeId !== before.equipeId) {
      responsavelId = null;
    }

    const previstaIgual =
      (before.previstaExecucaoEm?.toISOString() ?? null) === (previstaExecucaoEm?.toISOString() ?? null);
    const equipeIgual = (before.equipeId ?? null) === (equipeId ?? null);
    const responsavelIgual = (before.responsavelId ?? null) === (responsavelId ?? null);
    const prioridadeIgual = before.prioridade === prioridade;

    if (previstaIgual && equipeIgual && responsavelIgual && prioridadeIgual) {
      return this.serializeChamado(before);
    }

    const [equipeAnterior, equipeNova] = await Promise.all([
      before.equipeId
        ? this.prisma.equipe.findUnique({ where: { id: before.equipeId }, select: { nome: true } })
        : Promise.resolve(null),
      equipeId ? this.prisma.equipe.findUnique({ where: { id: equipeId }, select: { nome: true } }) : Promise.resolve(null),
    ]);

    const alteracoes = buildPlanejamentoAlteracoes({
      equipeAnterior,
      equipeNova,
      previstaAnterior: before.previstaExecucaoEm,
      previstaNova: previstaExecucaoEm,
      prioridadeAnterior: prioridadeIgual ? null : before.prioridade,
      prioridadeNova: prioridadeIgual ? null : prioridade,
    });

    const chamado = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.chamado.update({
        where: { id },
        data: { previstaExecucaoEm, equipeId, responsavelId, prioridade },
        include: this.includeRelations(),
      });

      await tx.historicoStatus.create({
        data: {
          entidadeTipo: 'Chamado',
          entidadeId: id,
          statusAnterior: before.status,
          statusNovo: before.status,
          motivo: 'Programação de execução atualizada.',
          alteradoPorId: user.sub,
          metadata: {
            tipo: 'programacao_update',
            previstaExecucaoEm: previstaExecucaoEm?.toISOString() ?? null,
            equipeId,
            equipeAnteriorId: before.equipeId,
            alteracoes,
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

  async updateTriagem(id: string, dto: UpdateChamadoTriagemDto, user: JwtPayload) {
    const before = await this.getChamadoOrThrow(id);
    assertChamadoSecretariaAccess(user, before);

    const tipoChamadoId =
      dto.tipoChamadoId === undefined
        ? before.tipoChamadoId
        : dto.tipoChamadoId?.trim()
          ? dto.tipoChamadoId.trim()
          : null;

    const prioridade = dto.prioridade ?? before.prioridade;

    if (tipoChamadoId) {
      const tipo = await this.prisma.tipoChamado.findFirst({ where: { id: tipoChamadoId, ativo: true } });
      if (!tipo) throw new BadRequestException('Tipo de chamado não encontrado ou inativo.');
    }

    let prazoEm = before.prazoEm;
    if (tipoChamadoId) {
      const tipo = await this.prisma.tipoChamado.findUniqueOrThrow({ where: { id: tipoChamadoId } });
      prazoEm = calcularPrazoSla(before.createdAt, prioridade, tipo);
    }

    if (
      (before.tipoChamadoId ?? null) === (tipoChamadoId ?? null) &&
      before.prioridade === prioridade &&
      (before.prazoEm?.toISOString() ?? null) === (prazoEm?.toISOString() ?? null)
    ) {
      return this.serializeChamado(before);
    }

    const tipoNovoRecord = tipoChamadoId
      ? await this.prisma.tipoChamado.findUnique({ where: { id: tipoChamadoId }, select: { nome: true } })
      : null;

    const alteracoes = buildTriagemAlteracoes({
      tipoAnterior: before.tipoChamado,
      tipoNovo: tipoNovoRecord,
      prioridadeAnterior: before.prioridade,
      prioridadeNova: prioridade,
      prazoAnterior: before.prazoEm,
      prazoNovo: prazoEm,
    });

    const chamado = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.chamado.update({
        where: { id },
        data: { tipoChamadoId, prioridade, prazoEm },
        include: this.includeRelations(),
      });

      await tx.historicoStatus.create({
        data: {
          entidadeTipo: 'Chamado',
          entidadeId: id,
          statusAnterior: before.status,
          statusNovo: before.status,
          motivo: 'Triagem atualizada.',
          alteradoPorId: user.sub,
          metadata: {
            tipo: 'triagem_update',
            tipoChamadoId,
            tipoChamadoAnteriorId: before.tipoChamadoId,
            prioridade,
            prioridadeAnterior: before.prioridade,
            prazoEm: prazoEm?.toISOString() ?? null,
            alteracoes,
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

  async registrarHistorico(id: string, dto: RegistrarChamadoHistoricoDto, user: JwtPayload) {
    const chamado = await this.getChamadoOrThrow(id);
    assertChamadoSecretariaAccess(user, chamado);

    const anexosInput = dto.anexos ?? [];
    const evidenciaIds: string[] = [];
    const storedKeys: string[] = [];

    try {
      for (const anexo of anexosInput) {
        const stored = await this.storageService.persistEvidenceUrl(anexo.dataUrl.trim(), anexo.mimeType);
        storedKeys.push(stored.storageKey);
        const isImage = (stored.mimeType ?? anexo.mimeType ?? '').startsWith('image/');
        const evidencia = await this.prisma.evidencia.create({
          data: {
            chamadoId: id,
            tipo: isImage ? EvidenciaTipo.FOTO : EvidenciaTipo.DOCUMENTO,
            url: stored.url,
            storageKey: stored.storageKey,
            mimeType: stored.mimeType,
            tamanhoBytes: stored.tamanhoBytes,
            checksum: stored.checksum,
            capturadaEm: new Date(),
            enviadaEm: new Date(),
            metadata: {
              origem: 'historico_manual',
              ...(anexo.nome?.trim() ? { nome: anexo.nome.trim() } : {}),
            },
          },
        });
        evidenciaIds.push(evidencia.id);
      }

      await this.prisma.historicoStatus.create({
        data: {
          entidadeTipo: 'Chamado',
          entidadeId: id,
          statusAnterior: chamado.status,
          statusNovo: chamado.status,
          motivo: 'Atualização de histórico',
          alteradoPorId: user.sub,
          metadata: {
            tipo: 'HISTORY_UPDATE',
            descricao: dto.descricao.trim(),
            evidenciaIds,
          },
        },
      });

      return this.getChamado(id, user);
    } catch (error) {
      if (storedKeys.length > 0) {
        await this.storageService.deleteStoredObjects(storedKeys);
      }
      throw error;
    }
  }

  async notificarEquipe(id: string, user: JwtPayload) {
    const chamado = await this.getChamadoOrThrow(id);
    assertChamadoSecretariaAccess(user, chamado);

    if (!chamado.equipeId) {
      throw new BadRequestException('Chamado sem equipe atribuída.');
    }

    const equipe = await this.prisma.equipe.findUnique({
      where: { id: chamado.equipeId },
      include: {
        membros: { include: { usuario: { select: { email: true, ativo: true } } } },
      },
    });

    if (!equipe) throw new BadRequestException('Equipe não encontrada.');

    const secretaria = await this.prisma.secretaria.findUnique({
      where: { id: chamado.secretariaId },
      select: { responsavelEmail: true },
    });

    const to = [
      equipe.emailEquipe,
      ...equipe.membros.filter((m) => m.usuario.ativo).map((m) => m.usuario.email),
    ].filter(Boolean) as string[];

    if (to.length === 0) {
      throw new BadRequestException('Equipe sem e-mail configurado ou membros com e-mail.');
    }

    const baseUrl =
      process.env.APP_PUBLIC_URL?.trim() ??
      process.env.STORAGE_PUBLIC_URL_BASE?.trim()?.replace(/\/api-(gestop|sigma)$/, '') ??
      '';
    const link = baseUrl ? `${baseUrl}/chamados?id=${chamado.id}` : `/chamados?id=${chamado.id}`;

    const endereco =
      chamado.unidade?.endereco ??
      ([chamado.enderecoTexto, chamado.enderecoBairro].filter(Boolean).join(' · ') || 'Endereço não informado');

    const serialized = this.serializeChamado(chamado);
    const fotos = [serialized.fotoUrl].filter(Boolean) as string[];

    const result = await sendChamadoEquipeNotificacao(this.emailService, {
      to,
      cc: secretaria?.responsavelEmail ? [secretaria.responsavelEmail] : undefined,
      chamado: {
        codigo: chamado.codigo,
        descricao: chamado.descricao,
        endereco,
        prazoSla: formatDateBr(chamado.prazoEm),
        link,
        fotos,
      },
    });

    await this.prisma.logAuditoria.create({
      data: {
        usuarioId: user.sub,
        acao: AuditAction.UPDATE,
        entidadeTipo: 'Chamado',
        entidadeId: id,
        valorNovo: {
          acao: 'notificar_equipe',
          delivered: result.delivered,
          driver: 'driver' in result ? result.driver : undefined,
        },
      },
    });

    return result;
  }

  async exportOrdensServicoLote(dto: EmitirOrdensServicoDto, user: JwtPayload) {
    const where: Prisma.ChamadoWhereInput = {
      ...resolveChamadoSecretariaFilter(user),
      status: { notIn: [ChamadoStatus.CONCLUIDO, ChamadoStatus.CANCELADO] },
    };

    if (dto.ids?.length) {
      where.id = { in: dto.ids };
    }

    if (dto.equipeId === 'sem-equipe') {
      where.equipeId = null;
    } else if (dto.equipeId?.trim()) {
      where.equipeId = dto.equipeId.trim();
    }

    const programacaoFilter = this.buildProgramacaoDateFilter({
      programacaoFrom: dto.programacaoFrom,
      programacaoTo: dto.programacaoTo,
      hoje: dto.hoje === true,
    });
    Object.assign(where, programacaoFilter);

    const chamados = await this.prisma.chamado.findMany({
      where,
      orderBy: [{ previstaExecucaoEm: 'asc' }, { prioridade: 'desc' }, { createdAt: 'asc' }],
      include: {
        unidade: { select: { endereco: true, bairro: true } },
        equipe: { select: { nome: true } },
        tipoChamado: { select: { nome: true } },
      },
    });

    if (chamados.length === 0) {
      throw new BadRequestException('Nenhum chamado encontrado para emissão de OS.');
    }

    return buildOrdensServicoLotePdf(
      chamados.map((item) => {
        const serialized = this.serializeChamado(item);
        return {
          codigo: item.codigo,
          tipo: item.tipoChamado?.nome ?? null,
          prioridade: item.prioridade,
          descricao: item.descricao,
          endereco:
            item.unidade?.endereco ??
            ([item.enderecoTexto, item.enderecoBairro].filter(Boolean).join(' · ') || '—'),
          equipe: item.equipe?.nome ?? null,
          prazoSla: item.prazoEm?.toISOString() ?? null,
          fotoUrl: serialized.fotoUrl,
        };
      }),
    );
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

    const sequence = await this.nextChamadoSequence(tx);
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

  private async resolveCreateLocation(dto: CreateChamadoDto, usuarioId: string) {
    if (dto.modoLocalizacao === ChamadoModoLocalizacao.UNIDADE) {
      if (!dto.unidadeId?.trim()) {
        throw new BadRequestException('Selecione o próprio público para abrir o chamado.');
      }
      const unidade = await this.getActiveUnidadeOrThrow(dto.unidadeId);
      return {
        secretariaId: unidade.secretariaId,
        unidadeId: unidade.id,
        latitude: unidade.latitude,
        longitude: unidade.longitude,
        enderecoTexto: null as string | null,
        enderecoBairro: null as string | null,
      };
    }

    if (dto.latitude == null || dto.longitude == null) {
      throw new BadRequestException('Informe a localização GPS do chamado.');
    }

    if (dto.modoLocalizacao === ChamadoModoLocalizacao.ENDERECO && !dto.enderecoTexto?.trim()) {
      throw new BadRequestException('Informe o endereço do chamado.');
    }

    let secretariaId = dto.secretariaId?.trim();
    if (!secretariaId) {
      const usuario = await this.prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: { secretariaId: true },
      });
      secretariaId = usuario?.secretariaId ?? undefined;
    }
    if (!secretariaId) {
      throw new BadRequestException('Selecione a secretaria responsável pelo chamado.');
    }

    const secretaria = await this.prisma.secretaria.findFirst({ where: { id: secretariaId, ativo: true } });
    if (!secretaria) throw new BadRequestException('Secretaria não encontrada ou inativa.');

    return {
      secretariaId: secretaria.id,
      unidadeId: null as string | null,
      latitude: dto.latitude,
      longitude: dto.longitude,
      enderecoTexto: dto.enderecoTexto?.trim() ?? null,
      enderecoBairro: dto.enderecoBairro?.trim() ?? null,
    };
  }

  private async resolveCheckinTarget(chamado: {
    unidadeId: string | null;
    latitude: unknown;
    longitude: unknown;
  }) {
    if (chamado.unidadeId) {
      const unidade = await this.prisma.unidadePublica.findUnique({
        where: { id: chamado.unidadeId },
        select: { latitude: true, longitude: true, raioValidacaoMetros: true },
      });
      if (!unidade) return null;
      return {
        latitude: Number(unidade.latitude),
        longitude: Number(unidade.longitude),
        raioValidacaoMetros: unidade.raioValidacaoMetros,
      };
    }

    if (chamado.latitude == null || chamado.longitude == null) return null;

    return {
      latitude: Number(chamado.latitude),
      longitude: Number(chamado.longitude),
      raioValidacaoMetros: DEFAULT_RAIO_VALIDACAO_METROS,
    };
  }

  private async resolveUnidadeExecucao(chamado: {
    unidadeId: string | null;
    latitude: unknown;
    longitude: unknown;
    enderecoTexto: string | null;
    enderecoBairro: string | null;
  }) {
    if (chamado.unidadeId) {
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
      if (!unidade) return null;
      return {
        latitude: Number(unidade.latitude),
        longitude: Number(unidade.longitude),
        raioValidacaoMetros: unidade.raioValidacaoMetros,
        endereco: unidade.endereco,
        bairro: unidade.bairro,
      };
    }

    if (chamado.latitude == null || chamado.longitude == null) return null;

    return {
      latitude: Number(chamado.latitude),
      longitude: Number(chamado.longitude),
      raioValidacaoMetros: DEFAULT_RAIO_VALIDACAO_METROS,
      endereco: chamado.enderecoTexto,
      bairro: chamado.enderecoBairro,
    };
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
      tipoChamado: { select: { id: true, nome: true } },
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
      where: { equipeId: chamado.equipeId, usuarioId: user.sub },
      select: { usuarioId: true },
      take: 1,
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
    const checkin = await this.findExecucaoCheckinHistorico(chamadoId);
    if (!checkin) {
      throw new BadRequestException('Confirme o check-in no local antes de continuar a execução.');
    }
  }

  private async findExecucaoCheckinHistorico(chamadoId: string) {
    const registro = await this.prisma.historicoStatus.findFirst({
      where: {
        entidadeTipo: 'Chamado',
        entidadeId: chamadoId,
        metadata: {
          path: ['tipo'],
          equals: 'execucao_checkin',
        },
      },
      orderBy: { createdAt: 'desc' },
      select: { metadata: true, createdAt: true },
    });

    if (!registro) return null;
    return parseExecucaoCheckinMetadata(registro.metadata, registro.createdAt);
  }

  private coordsAreEqual(
    a: { latitude: number; longitude: number },
    b: { latitude: number; longitude: number },
    epsilon = 0.000001,
  ) {
    return Math.abs(a.latitude - b.latitude) < epsilon && Math.abs(a.longitude - b.longitude) < epsilon;
  }

  private async listEvidenciasExecucaoCampo(chamadoId: string) {
    return this.prisma.evidencia.findMany({
      where: {
        chamadoId,
        metadata: {
          path: ['origem'],
          equals: 'execucao_campo',
        },
      },
      orderBy: { capturadaEm: 'asc' },
      select: { id: true },
    });
  }

  private serializeChamado<T extends {
    fotoUrl?: string | null;
    fotoStorageKey?: string | null;
    latitude?: unknown;
    longitude?: unknown;
    unidade?: Record<string, unknown> | null;
  }>(chamado: T) {
    const fotoStorageKey =
      chamado.fotoStorageKey ?? extractStorageKeyFromUrl(chamado.fotoUrl ?? null);

    return {
      ...chamado,
      fotoUrl: resolveStoragePublicUrl(fotoStorageKey, chamado.fotoUrl ?? null),
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
    storageKey?: string | null;
    mimeType: string | null;
    tamanhoBytes: number | null;
    latitude: unknown;
    longitude: unknown;
    precisaoMetros: unknown;
    capturadaEm: Date;
    metadata: unknown;
  }) {
    const storageKey = evidencia.storageKey ?? extractStorageKeyFromUrl(evidencia.url);

    return {
      id: evidencia.id,
      tipo: evidencia.tipo,
      url: resolveStoragePublicUrl(storageKey, evidencia.url) ?? evidencia.url,
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

  private async enrichHistorico(
    historico: Array<{
      id: string;
      statusAnterior: string | null;
      statusNovo: string;
      motivo: string | null;
      metadata: unknown;
      createdAt: Date;
      alteradoPor: { id: string; nome: string } | null;
    }>,
    entidadeId?: string,
  ) {
    const evidenciaIds = historico.flatMap((entry) => {
      const metadata = entry.metadata as { evidenciaIds?: string[] } | null;
      return metadata?.evidenciaIds ?? [];
    });

    const needsLegacyExecucaoEvidencias =
      Boolean(entidadeId) &&
      historico.some((entry) => {
        const metadata = entry.metadata as { tipo?: string; evidenciaIds?: string[] } | null;
        return metadata?.tipo === 'execucao_conclusao' && !(metadata.evidenciaIds?.length ?? 0);
      });

    const [evidencias, legacyExecucaoEvidencias] = await Promise.all([
      evidenciaIds.length > 0
        ? this.prisma.evidencia.findMany({
            where: {
              id: { in: evidenciaIds },
              ...(entidadeId ? { chamadoId: entidadeId } : {}),
            },
          })
        : Promise.resolve([]),
      needsLegacyExecucaoEvidencias && entidadeId
        ? this.prisma.evidencia.findMany({
            where: {
              chamadoId: entidadeId,
              metadata: {
                path: ['origem'],
                equals: 'execucao_campo',
              },
            },
            orderBy: { capturadaEm: 'asc' },
          })
        : Promise.resolve([]),
    ]);

    const evidenciaMap = new Map(evidencias.map((item) => [item.id, this.serializeEvidencia(item)]));
    const legacyExecucaoAnexos = legacyExecucaoEvidencias.map((item) => this.serializeEvidencia(item));
    const legacyExecucaoTargetId = [...historico]
      .reverse()
      .find((entry) => {
        const metadata = entry.metadata as { tipo?: string; evidenciaIds?: string[] } | null;
        return metadata?.tipo === 'execucao_conclusao' && !(metadata.evidenciaIds?.length ?? 0);
      })?.id;

    return historico.map((entry) => {
      const metadata = (entry.metadata ?? {}) as Record<string, unknown>;
      const ids = Array.isArray(metadata.evidenciaIds) ? (metadata.evidenciaIds as string[]) : [];
      const anexosFromIds = ids.map((id) => evidenciaMap.get(id)).filter(Boolean);
      const anexos =
        metadata.tipo === 'execucao_conclusao' &&
        anexosFromIds.length === 0 &&
        entry.id === legacyExecucaoTargetId
          ? legacyExecucaoAnexos
          : anexosFromIds;

      return {
        id: entry.id,
        statusAnterior: entry.statusAnterior,
        statusNovo: entry.statusNovo,
        motivo: entry.motivo,
        metadata,
        createdAt: entry.createdAt.toISOString(),
        alteradoPor: entry.alteradoPor,
        anexos,
      };
    });
  }

  private buildProgramacaoDateFilter(filters?: {
    programacaoFrom?: string;
    programacaoTo?: string;
    hoje?: boolean;
  }): Prisma.ChamadoWhereInput {
    if (!filters?.hoje && !filters?.programacaoFrom && !filters?.programacaoTo) {
      return {};
    }

    if (filters.hoje) {
      const key = todayDateKey();
      const from = parseDateKey(key);
      const to = new Date(`${key}T23:59:59.999Z`);
      return { previstaExecucaoEm: { gte: from, lte: to } };
    }

    const from = filters.programacaoFrom?.trim() ? parseDateKey(filters.programacaoFrom.trim()) : undefined;
    const toKey = filters.programacaoTo?.trim();
    const to = toKey ? new Date(`${toKey}T23:59:59.999Z`) : undefined;

    if (from && to) {
      return { previstaExecucaoEm: { gte: from, lte: to } };
    }
    if (from) {
      return { previstaExecucaoEm: { gte: from } };
    }
    if (to) {
      return { previstaExecucaoEm: { lte: to } };
    }

    return {};
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
