import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  ConformidadeStatus,
  EntidadeSincronizavel,
  EvidenciaTipo,
  FiscalizacaoOrigem,
  FiscalizacaoStatus,
  NaoConformidadeStatus,
  OfflineOperacao,
  OfflineSyncStatus,
  Prisma,
  Severidade,
} from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { JwtPayload } from '../auth/jwt';
import {
  resolveSecretariaScopeId,
  resolveSecretariaScopeIds,
  resolveUnidadeSecretariaFilter,
} from '../auth/secretaria-scope';
import { CHAMADO_OPEN_STATUSES } from '../chamados/chamados.rules';
import { ChamadosService } from '../chamados/chamados.service';
import { CronogramaService } from '../cronograma/cronograma.service';
import { projectChecagensNoPeriodo, startOfDay, toDateKey } from '../cronograma/cronograma.rules';
import { precisaoMaxCheckinMetros, validadePacoteDias } from './mobile.config';
import { avaliarConflitoProgramacao, validarAvulsaPorConflito } from './programacao-conflito';
import { entidadeTipoParaTela } from '../audit/audit.constants';
import { DocumentosService } from '../documentos/documentos.service';
import { FiscalizacoesService } from '../fiscalizacoes/fiscalizacoes.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { MobileSyncFiscalizacaoDto } from './mobile.dto';
import { validateMobileCheckin } from './mobile.rules';
import { buildFieldPackageChecklistWhere } from './field-package';
import { validateChecklistResponses } from '../domain/checklist-response.rules';
import { checklistAppliesToUnidade } from '../checklists/checklist-matching';

const MENSAGEM_FORA_DO_ESCOPO =
  'Este próprio não pertence a uma Secretaria do seu acesso. A vistoria continua na fila; fale com o gestor.';

@Injectable()
export class MobileService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ChamadosService))
    private readonly chamadosService: ChamadosService,
    private readonly storageService: StorageService,
    private readonly cronogramaService: CronogramaService,
    private readonly documentosService: DocumentosService,
    @Inject(forwardRef(() => FiscalizacoesService))
    private readonly fiscalizacoesService: FiscalizacoesService,
    private readonly authService: AuthService,
  ) {}

  async listVistoriasProgramadas(
    query: {
      from?: string;
      to?: string;
      atribuidoAMim?: boolean;
      tipo?: string;
      unidadeId?: string;
    },
    user: JwtPayload,
  ) {
    return this.cronogramaService.listVistoriasProgramadas(query, user);
  }

  async getFieldPackage(user: JwtPayload) {
    const scopeIds = resolveSecretariaScopeIds(user);
    const activeSecretariaId = resolveSecretariaScopeId(user) ?? null;
    const unidadeScope = resolveUnidadeSecretariaFilter(user);

    const unidadeWhere: Prisma.UnidadePublicaWhereInput = {
      ativo: true,
      ...unidadeScope,
    };

    const checklistWhere = buildFieldPackageChecklistWhere(
      activeSecretariaId,
      !activeSecretariaId && scopeIds ? scopeIds : undefined,
    );

    const [unidades, checklists] = await Promise.all([
      this.prisma.unidadePublica.findMany({
        where: unidadeWhere,
        orderBy: { nome: 'asc' },
        select: {
          id: true,
          nome: true,
          codigoPatrimonial: true,
          tipo: true,
          endereco: true,
          bairro: true,
          latitude: true,
          longitude: true,
          raioValidacaoMetros: true,
          secretaria: { select: { id: true, nome: true, sigla: true } },
        },
      }),
      this.prisma.checklist.findMany({
        where: checklistWhere,
        orderBy: { nome: 'asc' },
        include: {
          versoes: {
            where: { status: 'PUBLICADA' },
            orderBy: { versao: 'desc' },
            take: 1,
            include: { itens: { where: { ativo: true }, orderBy: { ordem: 'asc' } } },
          },
        },
      }),
    ]);

    // 304/O1: programações no pacote (mesmo escopo da lista online), com a versão publicada do checklist.
    const hoje = startOfDay(new Date());
    const { items: programadas } = await this.cronogramaService.listVistoriasProgramadas(
      { from: toDateKey(new Date(hoje.getTime() - 90 * 86_400_000)), to: toDateKey(new Date(hoje.getTime() + 30 * 86_400_000)) },
      user,
    );
    const versaoPorChecklist = new Map(
      checklists.flatMap((c) => (c.versoes[0] ? [[c.id, { id: c.versoes[0].id, versao: c.versoes[0].versao }] as const] : [])),
    );
    const programacoes = programadas.map((item) => ({
      ...item,
      checklistVersao: versaoPorChecklist.get(item.checklist.id) ?? null,
    }));

    const downloadedAt = new Date();
    const validadeDias = validadePacoteDias();
    return {
      downloadedAt: downloadedAt.toISOString(),
      // 304/O9 (D3): validade do pacote; vencido, o app avisa e continua utilizável.
      validoAte: new Date(downloadedAt.getTime() + validadeDias * 86_400_000).toISOString(),
      validadeDias,
      // 303/G2a: o app valida a precisão do check-in com o mesmo limite do backend.
      config: { precisaoMaxCheckinMetros: precisaoMaxCheckinMetros() },
      contadores: { unidades: unidades.length, checklists: checklists.length, programacoes: programacoes.length },
      programacoes,
      secretariaEscopo: {
        ativaId: activeSecretariaId,
        todas: scopeIds === undefined,
      },
      unidades: unidades.map((unidade) => ({
        ...unidade,
        latitude: Number(unidade.latitude),
        longitude: Number(unidade.longitude),
      })),
      checklists,
    };
  }

  async syncFiscalizacao(dto: MobileSyncFiscalizacaoDto, user: JwtPayload) {
    // 304/O5b: reenvio da mesma vistoria = sucesso com o mesmo id e a programação baixada (nunca "duplicado" em aberto).
    const reenvio = await this.respostaReenvio(dto.clientEventId, user);
    if (reenvio) return reenvio;

    const unidade = await this.prisma.unidadePublica.findUnique({
      where: { id: dto.unidadeId },
    });
    if (!unidade) {
      throw new NotFoundException('Próprio não encontrado.');
    }
    // 304/O10: unidade (e, por ela, a programação) precisa ser de uma Secretaria do usuário.
    const escopo = resolveSecretariaScopeIds(user);
    if (escopo && !escopo.includes(unidade.secretariaId)) {
      const motivo = MENSAGEM_FORA_DO_ESCOPO;
      await this.createSyncFailure(dto, user, motivo);
      throw new ForbiddenException(motivo);
    }

    // 303/G3a: início = check-in, fim = Concluir; o fim não pode ser antes do início.
    if (new Date(dto.iniciadaEm).getTime() > new Date(dto.concluidaEm).getTime()) {
      throw new BadRequestException('Horário de início (check-in) posterior ao de conclusão.');
    }
    // 304/O6a: "Enviar como avulsa" exige motivo e a referência da programação; nunca dá baixa nela.
    const erroAvulsa = validarAvulsaPorConflito(dto);
    if (erroAvulsa) throw new BadRequestException(erroAvulsa);
    const avulsa = dto.avulsaPorConflito
      ? {
          motivo: dto.avulsaPorConflito.motivo.trim(),
          cronogramaId: dto.avulsaPorConflito.cronogramaId.trim(),
          // data-chave local (mesma regra do avaliarConflitoProgramacao), sem deslocar o dia pelo fuso
          dataProgramada: startOfDay(new Date(`${dto.avulsaPorConflito.dataProgramada.slice(0, 10)}T12:00:00`)),
          codigo: dto.avulsaPorConflito.codigo?.trim() || null,
          referenciaExiste: true,
        }
      : null;
    if (avulsa) {
      const ref = await this.prisma.cronogramaChecagem.findUnique({ where: { id: avulsa.cronogramaId }, select: { unidadeId: true } });
      if (ref && ref.unidadeId !== unidade.id) {
        throw new BadRequestException('A programação informada no conflito é de outro próprio.');
      }
      // Programação excluída (PROGRAMACAO_INEXISTENTE): a referência fica só na auditoria (FK opcional).
      if (!ref) avulsa.referenciaExiste = false;
    }

    const checklistVersao = await this.prisma.checklistVersao.findUniqueOrThrow({
      where: { id: dto.checklistVersaoId },
      include: {
        itens: true,
        checklist: {
          select: {
            id: true,
            escopo: true,
            secretariaId: true,
            unidadeId: true,
            unidadeTipo: true,
            ativo: true,
          },
        },
      },
    });

    if (checklistVersao.status !== 'PUBLICADA') {
      throw new BadRequestException('Somente versoes publicadas podem ser usadas em campo.');
    }

    if (
      !checklistAppliesToUnidade(checklistVersao.checklist, {
        id: unidade.id,
        tipo: unidade.tipo,
        secretariaId: unidade.secretariaId,
      })
    ) {
      throw new BadRequestException('Este checklist nao se aplica ao tipo ou secretaria do proprio selecionado.');
    }

    // 304/O6: programação alterada ou já baixada no servidor → conflito sinalizado, nada é sobrescrito.
    const cronogramaId = dto.cronogramaId?.trim() || null;
    if (cronogramaId) {
      const cronograma = await this.prisma.cronogramaChecagem.findUnique({ where: { id: cronogramaId } });
      const conflito = avaliarConflitoProgramacao({
        cronograma,
        unidadeId: unidade.id,
        checklistId: checklistVersao.checklist.id,
        dataProgramada: dto.dataProgramada ?? null,
        programacaoAtualizadaEm: dto.programacaoAtualizadaEm ?? null,
        projetar: (c, dia) =>
          projectChecagensNoPeriodo({ proximaChecagemEm: c.proximaChecagemEm, frequencia: c.frequencia, from: dia, to: dia }).length > 0,
      });
      if (conflito) {
        await this.createSyncFailure(dto, user, `${conflito.codigo}: ${conflito.mensagem}`);
        throw new ConflictException({ statusCode: 409, codigo: conflito.codigo, message: conflito.mensagem, conflito: true });
      }
    }

    const checkinValidation = validateMobileCheckin({
      unidade: {
        latitude: Number(unidade.latitude),
        longitude: Number(unidade.longitude),
        raioValidacaoMetros: unidade.raioValidacaoMetros,
      },
      checkin: dto.checkin,
    });

    if (!checkinValidation.valid) {
      await this.createSyncFailure(dto, user, checkinValidation.reasons.join('; '));
      throw new BadRequestException(checkinValidation.reasons.join('; '));
    }

    const itemById = new Map(checklistVersao.itens.map((item) => [item.id, item]));
    const responsesValidation = validateChecklistResponses(
      checklistVersao.itens.map((item) => ({
        id: item.id,
        titulo: item.titulo,
        tipo: item.tipo,
        obrigatorio: item.obrigatorio,
        exigeEvidencia: item.exigeEvidencia,
        opcoes: item.opcoes,
      })),
      dto.respostas.map((resposta) => ({
        itemId: resposta.itemId,
        conformidade: resposta.conformidade,
        valorTexto: resposta.valorTexto,
        comentario: resposta.comentario,
        evidenciasCount: resposta.evidencias.length,
      })),
    );

    if (!responsesValidation.valid) {
      await this.createSyncFailure(dto, user, responsesValidation.reasons.join('; '));
      throw new BadRequestException(responsesValidation.reasons.join('; '));
    }

    const respostasPreparadas = await Promise.all(
      dto.respostas.map(async (resposta) => ({
        ...resposta,
        evidenciasArmazenadas: await Promise.all(
          resposta.evidencias.map(async (evidencia) => ({
            original: evidencia,
            stored: await this.storageService.persistEvidenceUrl(evidencia.url, evidencia.mimeType),
          })),
        ),
      })),
    );

    const persistedStorageKeys = respostasPreparadas.flatMap((resposta) =>
      resposta.evidenciasArmazenadas.map((evidencia) => evidencia.stored.storageKey),
    );

    try {
      const result = await this.prisma.$transaction(async (tx) => {
      const fiscalizacao = await tx.fiscalizacao.create({
        data: {
          clientId: dto.clientEventId,
          secretariaId: unidade.secretariaId,
          unidadeId: unidade.id,
          checklistVersaoId: checklistVersao.id,
          agenteId: user.sub,
          status: FiscalizacaoStatus.CONCLUIDA,
          origem: FiscalizacaoOrigem.OFFLINE,
          iniciadaEm: new Date(dto.iniciadaEm),
          concluidaEm: new Date(dto.concluidaEm),
          checkinLatitude: dto.checkin.latitude,
          checkinLongitude: dto.checkin.longitude,
          checkinPrecisaoMetros: dto.checkin.precisaoMetros,
          distanciaCheckinMetros: checkinValidation.result.distanceMeters,
          dentroRaioPermitido: true,
          cronogramaId,
          dataProgramada: dto.dataProgramada ? new Date(dto.dataProgramada) : null,
          ...(avulsa
            ? {
                avulsaPorConflito: true,
                avulsaMotivo: avulsa.motivo,
                conflitoCronogramaId: avulsa.referenciaExiste ? avulsa.cronogramaId : null,
                conflitoDataProgramada: avulsa.dataProgramada,
                conflitoCodigo: avulsa.codigo,
              }
            : {}),
        },
      });
      if (avulsa) {
        // 304/O6a: auditoria obrigatória (quem, quando, motivo), na MESMA transação — não depende da config de auditoria.
        const tela = entidadeTipoParaTela('Fiscalizacao');
        await tx.logAuditoria.create({
          data: {
            usuarioId: user.sub,
            acao: AuditAction.CREATE,
            entidadeTipo: 'Fiscalizacao',
            entidadeId: fiscalizacao.id,
            tela: tela.telaId,
            funcao: tela.funcaoId,
            descricao: `Vistoria enviada como avulsa por conflito de programação: ${avulsa.motivo}`,
            valorNovo: {
              evento: 'AVULSA_POR_CONFLITO',
              enviadoPorId: user.sub,
              enviadoPorNome: user.nome ?? null,
              enviadoEm: new Date().toISOString(),
              motivo: avulsa.motivo,
              codigoConflito: avulsa.codigo,
              cronogramaId: avulsa.cronogramaId,
              dataProgramada: toDateKey(avulsa.dataProgramada),
              clientEventId: dto.clientEventId,
            },
            secretariaAtivaId: user.secretariaId ?? null,
          },
        });
      }

      for (const resposta of respostasPreparadas) {
        const item = itemById.get(resposta.itemId)!;
        const respostaCriada = await tx.respostaChecklist.create({
          data: {
            fiscalizacaoId: fiscalizacao.id,
            itemId: resposta.itemId,
            conformidade: resposta.conformidade,
            valorBooleano: resposta.valorBooleano,
            valorTexto: resposta.valorTexto,
            valorNumero: resposta.valorNumero,
            comentario: resposta.comentario,
          },
        });

        let naoConformidadeId: string | null = null;
        if (resposta.conformidade === ConformidadeStatus.NAO_CONFORME && item.geraNaoConformidade) {
          const naoConformidade = await tx.naoConformidade.create({
            data: {
              fiscalizacaoId: fiscalizacao.id,
              respostaId: respostaCriada.id,
              itemId: resposta.itemId,
              unidadeId: unidade.id,
              registradaPorId: user.sub,
              severidade: Severidade.MEDIA,
              status: NaoConformidadeStatus.ABERTA,
              descricao: resposta.comentario ?? item.titulo,
              latitude: dto.checkin.latitude,
              longitude: dto.checkin.longitude,
              evidenciaObrigatoriaAtendida: resposta.evidenciasArmazenadas.length > 0,
            },
          });
          naoConformidadeId = naoConformidade.id;
        }

        for (const evidencia of resposta.evidenciasArmazenadas) {
          await tx.evidencia.create({
            data: {
              fiscalizacaoId: fiscalizacao.id,
              respostaId: respostaCriada.id,
              naoConformidadeId,
              tipo: evidencia.original.tipo ?? EvidenciaTipo.FOTO,
              url: evidencia.stored.url,
              storageKey: evidencia.stored.storageKey,
              mimeType: evidencia.stored.mimeType ?? evidencia.original.mimeType,
              tamanhoBytes: evidencia.stored.tamanhoBytes || evidencia.original.tamanhoBytes,
              checksum: evidencia.stored.checksum,
              latitude: evidencia.original.localizacao.latitude,
              longitude: evidencia.original.localizacao.longitude,
              precisaoMetros: evidencia.original.localizacao.precisaoMetros,
              capturadaEm: new Date(evidencia.original.capturadaEm),
              enviadaEm: new Date(),
            },
          });
        }

        if (naoConformidadeId && resposta.gerarChamado !== false) {
          await this.chamadosService.generateForNaoConformidadeTx(tx, naoConformidadeId, user.sub);
        }
      }

      // Upsert: um envio anterior pode ter ficado como CONFLITO/FALHOU (ex.: fora do escopo, GPS) e agora passa.
      const syncEvent = await tx.offlineSyncEvent.upsert({
        where: { clientEventId: dto.clientEventId },
        create: {
          clientEventId: dto.clientEventId,
          deviceId: dto.deviceId,
          usuarioId: user.sub,
          entidadeTipo: EntidadeSincronizavel.FISCALIZACAO,
          entidadeId: fiscalizacao.id,
          operacao: OfflineOperacao.UPSERT,
          payload: dto as unknown as Prisma.InputJsonValue,
          status: OfflineSyncStatus.SINCRONIZADO,
          ocorridoEm: new Date(dto.concluidaEm),
          sincronizadoEm: new Date(),
        },
        update: {
          entidadeId: fiscalizacao.id,
          payload: dto as unknown as Prisma.InputJsonValue,
          status: OfflineSyncStatus.SINCRONIZADO,
          conflitoMotivo: null,
          ultimoErro: null,
          sincronizadoEm: new Date(),
          tentativas: { increment: 1 },
        },
      });

      await tx.logAuditoria.create({
        data: {
          usuarioId: user.sub,
          acao: AuditAction.SYNC,
          entidadeTipo: 'Fiscalizacao',
          entidadeId: fiscalizacao.id,
          valorNovo: dto as unknown as Prisma.InputJsonValue,
        },
      });

      // 304/O5a: baixa da programação na MESMA transação da vistoria (falhou um, nenhum é gravado).
      // 304/O6a: avulsa por conflito NÃO baixa a programação (nem pela chave próprio+checklist); ela fica pendente e sinalizada.
      const programacao = avulsa
        ? null
        : await this.cronogramaService.registrarChecagemRealizadaTx(tx, {
            cronogramaId,
            unidadeId: unidade.id,
            checklistId: checklistVersao.checklist.id,
            concluidaEm: new Date(dto.concluidaEm),
          });

      return { fiscalizacao, syncEvent, programacao };
      });

      let pdfBuffer: Buffer | null = null;
      try {
        pdfBuffer = await this.fiscalizacoesService.exportPdf(result.fiscalizacao.id, user);
      } catch {
        pdfBuffer = null;
      }
      try {
        await this.documentosService.upsertFromFiscalizacao({
          fiscalizacaoId: result.fiscalizacao.id,
          secretariaId: unidade.secretariaId,
          unidadeId: unidade.id,
          checklistVersaoId: checklistVersao.id,
          responsavelId: user.sub,
          criadoPorId: user.sub,
          titulo: `Relatório de vistoria · ${unidade.nome}`,
          pdfBuffer,
        });
      } catch {
        // Não bloqueia sincronização da vistoria.
      }

      return {
        status: 'sincronizado' as const,
        reenvio: false,
        fiscalizacaoId: result.fiscalizacao.id,
        avulsaPorConflito: Boolean(avulsa),
        syncEventId: result.syncEvent.id,
        programacao: result.programacao
          ? { cronogramaId: result.programacao.id, baixada: true, proximaChecagemEm: result.programacao.proximaChecagemEm.toISOString() }
          : null,
      };
    } catch (error) {
      await this.storageService.deleteStoredObjects(persistedStorageKeys);
      // O5b: dois envios simultâneos da mesma vistoria — o perdedor responde como reenvio.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const r = await this.respostaReenvio(dto.clientEventId, user);
        if (r) return r;
      }
      throw error;
    }
  }

  /** O5b: vistoria já gravada para este clientEventId → mesmo id, programação baixada (garante a baixa de envios antigos). */
  private async respostaReenvio(clientEventId: string, user: JwtPayload) {
    const fiscalizacao = await this.prisma.fiscalizacao.findUnique({
      where: { clientId: clientEventId },
      select: { id: true, unidadeId: true, secretariaId: true, cronogramaId: true, concluidaEm: true, checklistVersao: { select: { checklistId: true } } },
    });
    if (!fiscalizacao) return null;
    // M-1: reenvio de fora do escopo → 403 igual ao O10 (não revela o id nem mexe no evento já sincronizado).
    const escopo = resolveSecretariaScopeIds(user);
    if (escopo && !escopo.includes(fiscalizacao.secretariaId)) {
      throw new ForbiddenException(MENSAGEM_FORA_DO_ESCOPO);
    }
    const syncEvent = await this.prisma.offlineSyncEvent.findUnique({ where: { clientEventId }, select: { id: true } });
    let programacao: { id: string; proximaChecagemEm: Date } | null = null;
    if (fiscalizacao.cronogramaId && fiscalizacao.concluidaEm) {
      // Vistorias gravadas antes deste PR (baixa fora da transação) podem ter ficado sem a baixa: aplica agora (idempotente).
      programacao = await this.cronogramaService.registrarChecagemRealizadaTx(this.prisma, {
        cronogramaId: fiscalizacao.cronogramaId,
        unidadeId: fiscalizacao.unidadeId,
        checklistId: fiscalizacao.checklistVersao.checklistId,
        concluidaEm: fiscalizacao.concluidaEm,
      });
    }
    return {
      status: 'sincronizado' as const,
      reenvio: true,
      fiscalizacaoId: fiscalizacao.id,
      syncEventId: syncEvent?.id ?? null,
      programacao: programacao
        ? { cronogramaId: programacao.id, baixada: true, proximaChecagemEm: programacao.proximaChecagemEm.toISOString() }
        : null,
    };
  }

  async reprocessPendingSyncEvents(actor: JwtPayload, limit = 25) {
    const events = await this.prisma.offlineSyncEvent.findMany({
      where: {
        status: { in: [OfflineSyncStatus.PENDENTE, OfflineSyncStatus.FALHOU, OfflineSyncStatus.CONFLITO] },
        entidadeTipo: EntidadeSincronizavel.FISCALIZACAO,
      },
      orderBy: { recebidoEm: 'asc' },
      take: limit,
    });

    let processados = 0;
    let sucesso = 0;
    let falhas = 0;
    const erros: Array<{ id: string; erro: string }> = [];

    for (const event of events) {
      const result = await this.reprocessOneSyncEvent(event, actor);
      processados += 1;
      if (result.ok) sucesso += 1;
      else {
        falhas += 1;
        erros.push({ id: event.id, erro: result.erro ?? 'Erro desconhecido' });
      }
    }

    return { processados, sucesso, falhas, erros };
  }

  async reprocessSyncEventById(id: string, actor: JwtPayload) {
    const event = await this.prisma.offlineSyncEvent.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Evento de sincronização não encontrado.');
    return this.reprocessOneSyncEvent(event, actor);
  }

  private async reprocessOneSyncEvent(
    event: { id: string; usuarioId: string | null; payload: Prisma.JsonValue; entidadeTipo: EntidadeSincronizavel },
    actor: JwtPayload,
  ) {
    if (event.entidadeTipo !== EntidadeSincronizavel.FISCALIZACAO) {
      return { ok: false, erro: 'Tipo de sincronização não suportado para retentativa automática.' };
    }
    const user = await this.resolveSyncUser(event.usuarioId, actor);
    try {
      const dto = event.payload as unknown as MobileSyncFiscalizacaoDto;
      const result = await this.syncFiscalizacao(dto, user);
      return { ok: true as const, status: result.reenvio ? 'duplicado' : result.status };
    } catch (error) {
      return { ok: false as const, erro: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  }

  private async resolveSyncUser(usuarioId: string | null, fallback: JwtPayload): Promise<JwtPayload> {
    if (!usuarioId) return fallback;
    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId }, select: { id: true, email: true, nome: true } });
    if (!usuario) return fallback;
    // O10: reprocessar com a sessão do autor (perfis, permissões e Secretarias), para o escopo valer igual ao envio.
    const sessao = await this.authService.resolveActiveSession(usuario.id);
    return { sub: usuario.id, email: usuario.email, nome: usuario.nome, ...sessao } as JwtPayload;
  }

  private createSyncFailure(dto: MobileSyncFiscalizacaoDto, user: JwtPayload, reason: string) {
    return this.prisma.offlineSyncEvent.upsert({
      where: { clientEventId: dto.clientEventId },
      create: {
        clientEventId: dto.clientEventId,
        deviceId: dto.deviceId,
        usuarioId: user.sub,
        entidadeTipo: EntidadeSincronizavel.FISCALIZACAO,
        operacao: OfflineOperacao.UPSERT,
        payload: dto as unknown as Prisma.InputJsonValue,
        status: OfflineSyncStatus.CONFLITO,
        conflitoMotivo: reason,
        ocorridoEm: new Date(dto.concluidaEm),
        tentativas: 1,
      },
      update: {
        status: OfflineSyncStatus.CONFLITO,
        conflitoMotivo: reason,
        tentativas: { increment: 1 },
        ultimoErro: reason,
      },
    });
  }

  /** Chamados pendentes do próprio — consulta durante preenchimento da vistoria (ticket 178). */
  async listChamadosPendentesUnidade(unidadeId: string, user: JwtPayload) {
    const scope = resolveUnidadeSecretariaFilter(user);
    const unidade = await this.prisma.unidadePublica.findFirst({
      where: { id: unidadeId, ativo: true, ...scope },
      select: { id: true, nome: true },
    });
    if (!unidade) {
      throw new NotFoundException('Próprio não encontrado ou fora do escopo.');
    }

    const chamados = await this.prisma.chamado.findMany({
      where: {
        excluidoEm: null,
        unidadeId,
        status: { in: CHAMADO_OPEN_STATUSES },
      },
      orderBy: [{ prioridade: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        codigo: true,
        titulo: true,
        descricao: true,
        status: true,
        prioridade: true,
        createdAt: true,
        previstaExecucaoEm: true,
        prazoEm: true,
        fotoUrl: true,
        tipoChamado: { select: { id: true, nome: true } },
        equipe: { select: { id: true, nome: true } },
        responsavel: { select: { id: true, nome: true } },
        evidencias: {
          orderBy: { capturadaEm: 'desc' },
          take: 8,
          select: {
            id: true,
            tipo: true,
            url: true,
            mimeType: true,
            capturadaEm: true,
          },
        },
      },
    });

    return {
      unidade: { id: unidade.id, nome: unidade.nome },
      items: chamados.map((chamado) => ({
        ...chamado,
        createdAt: chamado.createdAt.toISOString(),
        previstaExecucaoEm: chamado.previstaExecucaoEm?.toISOString() ?? null,
        prazoEm: chamado.prazoEm?.toISOString() ?? null,
        evidencias: chamado.evidencias.map((ev) => ({
          ...ev,
          capturadaEm: ev.capturadaEm.toISOString(),
        })),
      })),
    };
  }
}
