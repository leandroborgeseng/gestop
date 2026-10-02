import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  ChamadoPrioridade,
  ChamadoTarefaStatus,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { hasAnyPermission, isAdministradorSistema } from '../auth/permissions';
import { JwtPayload } from '../auth/jwt';
import { resolveChamadoSecretariaFilter, resolveSecretariaScopeIds } from '../auth/secretaria-scope';
import { permissionMatrixKey } from '../domain/permissions-catalog';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { normalizarMimeAnexo, validarBufferAnexo } from './anexos-midia';
import { situacaoPrazoTarefa, TAREFA_STATUS_FINAIS, TAREFA_STATUS_PENDENTES, tarefaAtrasada } from './chamado-tarefa.regras';
import { AnexoChamadoTarefaDto, CreateChamadoTarefaDto, UpdateChamadoTarefaDto } from './chamado-tarefas.dto';

const TAREFA_INCLUDE = {
  secretaria: { select: { id: true, nome: true, sigla: true } },
  equipe: { select: { id: true, nome: true, codigo: true } },
  responsavel: { select: { id: true, nome: true, email: true } },
  criadaPor: { select: { id: true, nome: true } },
  concluidaPor: { select: { id: true, nome: true } },
  anexos: {
    orderBy: { createdAt: 'asc' as const },
    select: { id: true, nome: true, url: true, mimeType: true, tamanhoBytes: true, createdAt: true },
  },
  chamado: {
    select: {
      id: true,
      codigo: true,
      titulo: true,
      descricao: true,
      status: true,
      prioridade: true,
      enderecoTexto: true,
      latitude: true,
      longitude: true,
      prazoEm: true,
      excluidoEm: true,
      tipoChamado: { select: { id: true, nome: true } },
      unidade: { select: { id: true, nome: true, endereco: true, latitude: true, longitude: true } },
      secretaria: { select: { id: true, nome: true, sigla: true } },
      equipe: { select: { id: true, nome: true } },
    },
  },
} satisfies Prisma.ChamadoTarefaInclude;

type TarefaLoaded = Prisma.ChamadoTarefaGetPayload<{ include: typeof TAREFA_INCLUDE }>;

@Injectable()
export class ChamadoTarefasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  async opcoes(user: JwtPayload, secretariaId?: string) {
    this.assertPodeAtribuir(user);
    const secretarias = await this.prisma.secretaria.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, sigla: true },
    });
    const equipes = secretariaId
      ? await this.prisma.equipe.findMany({
          where: { ativo: true, secretariaId },
          orderBy: { nome: 'asc' },
          select: {
            id: true,
            nome: true,
            codigo: true,
            membros: {
              where: { usuario: { ativo: true } },
              select: { usuario: { select: { id: true, nome: true, email: true } } },
            },
          },
        })
      : [];
    return { secretarias, equipes };
  }

  async listByChamado(chamadoId: string, user: JwtPayload) {
    await this.requireChamadoOperacional(chamadoId, user);
    const items = await this.prisma.chamadoTarefa.findMany({
      where: { chamadoId },
      include: TAREFA_INCLUDE,
      orderBy: [{ status: 'asc' }, { prazo: 'asc' }, { createdAt: 'desc' }],
    });
    const equipes = await this.equipeIdsDoUsuario(user.sub);
    const visiveis = [];
    for (const item of items) {
      if (await this.podeVer(item, user)) visiveis.push(this.serialize(item, user, equipes));
    }
    const pendentes = visiveis.filter((item) => TAREFA_STATUS_PENDENTES.includes(item.status as (typeof TAREFA_STATUS_PENDENTES)[number])).length;
    return { total: visiveis.length, pendentes, items: visiveis };
  }

  async create(dto: CreateChamadoTarefaDto, user: JwtPayload) {
    if (!this.podeInserir(user)) {
      throw new ForbiddenException('Sem permissão para criar tarefa.');
    }
    const chamado = await this.requireChamadoOperacional(dto.chamadoId, user);
    await this.validarAtribuicao(dto.secretariaId, dto.equipeId ?? null, dto.responsavelId ?? null);
    const criada = await this.prisma.chamadoTarefa.create({
      data: {
        chamadoId: dto.chamadoId,
        titulo: dto.titulo.trim(),
        descricao: dto.descricao?.trim() || null,
        prazo: dto.prazo ? new Date(dto.prazo) : null,
        secretariaId: dto.secretariaId,
        equipeId: dto.equipeId ?? null,
        responsavelId: dto.responsavelId ?? null,
        prioridade: dto.prioridade ?? ChamadoPrioridade.MEDIA,
        status: ChamadoTarefaStatus.NOVA,
        criadaPorId: user.sub,
      },
      include: TAREFA_INCLUDE,
    });
    await this.registrarTrilha(criada, user, 'criada', criadoResumo(criada));
    return this.serialize(criada, user, await this.equipeIdsDoUsuario(user.sub));
  }

  async getById(id: string, user: JwtPayload) {
    const tarefa = await this.requireTarefa(id);
    if (!(await this.podeVer(tarefa, user))) throw new NotFoundException('Tarefa não encontrada.');
    const equipes = await this.equipeIdsDoUsuario(user.sub);
    const autorizado =
      tarefa.responsavelId === user.sub ||
      (tarefa.equipeId ? equipes.has(tarefa.equipeId) : false) ||
      this.podeAlterar(user) ||
      this.podeAndamento(user) ||
      this.podeConcluir(user);
    if (tarefa.status === ChamadoTarefaStatus.NOVA && autorizado) {
      const updated = await this.prisma.chamadoTarefa.update({
        where: { id },
        data: { status: ChamadoTarefaStatus.VISUALIZADA, visualizadaEm: tarefa.visualizadaEm ?? new Date() },
        include: TAREFA_INCLUDE,
      });
      await this.registrarTrilha(updated, user, 'visualizada', 'Abertura da tarefa.', tarefa.status);
      return this.detalhe(updated, user, equipes);
    }
    await this.registrarTrilha(tarefa, user, 'visualizada', 'Abertura da tarefa.', tarefa.status);
    return this.detalhe(tarefa, user, equipes);
  }

  async update(id: string, dto: UpdateChamadoTarefaDto, user: JwtPayload) {
    const before = await this.requireTarefa(id);
    if (!(await this.podeVer(before, user))) throw new NotFoundException('Tarefa não encontrada.');
    if (dto.status === ChamadoTarefaStatus.IMPEDIDA) {
      throw new BadRequestException(
        'O status Impedida saiu da rotina. Cancele a tarefa com justificativa, se for o caso. Registros antigos permanecem no histórico.',
      );
    }
    if (dto.status === ChamadoTarefaStatus.VISUALIZADA) {
      throw new BadRequestException('A visualização é registrada automaticamente ao abrir a tarefa.');
    }

    const encerrada = TAREFA_STATUS_FINAIS.includes(before.status as (typeof TAREFA_STATUS_FINAIS)[number]);
    const mudaCampo =
      dto.titulo != null ||
      dto.descricao != null ||
      dto.prazo !== undefined ||
      dto.secretariaId != null ||
      dto.equipeId !== undefined ||
      dto.responsavelId !== undefined ||
      dto.prioridade != null;
    if (mudaCampo && encerrada) throw new BadRequestException('Tarefa encerrada não pode ser editada.');
    if (mudaCampo && !this.podeAlterar(user)) {
      throw new ForbiddenException('Sem permissão para alterar os dados da tarefa.');
    }

    const secretariaId = dto.secretariaId ?? before.secretariaId;
    const equipeId = dto.equipeId === undefined ? before.equipeId : dto.equipeId;
    const responsavelId = dto.responsavelId === undefined ? before.responsavelId : dto.responsavelId;
    if (mudaCampo) await this.validarAtribuicao(secretariaId, equipeId, responsavelId);

    const designado = before.responsavelId === user.sub || (await this.ehMembro(before.equipeId, user.sub));
    const data: Prisma.ChamadoTarefaUpdateInput = {};
    if (dto.titulo != null) data.titulo = dto.titulo.trim();
    if (dto.descricao != null) data.descricao = dto.descricao.trim() || null;
    if (dto.prazo !== undefined) data.prazo = dto.prazo ? new Date(dto.prazo) : null;
    if (dto.secretariaId) data.secretaria = { connect: { id: dto.secretariaId } };
    if (dto.equipeId !== undefined) data.equipe = dto.equipeId ? { connect: { id: dto.equipeId } } : { disconnect: true };
    if (dto.responsavelId !== undefined) {
      data.responsavel = dto.responsavelId ? { connect: { id: dto.responsavelId } } : { disconnect: true };
    }
    if (dto.prioridade) data.prioridade = dto.prioridade;

    let acao: string | null = null;
    let detalhe: string | null = null;
    if (dto.status === ChamadoTarefaStatus.CANCELADA) {
      if (encerrada) throw new BadRequestException('Tarefa concluída ou cancelada não muda de status.');
      if (!this.podeCancelar(user)) throw new ForbiddenException('Sem permissão para cancelar a tarefa.');
      const justificativa = dto.justificativa?.trim() ?? '';
      if (justificativa.length < 3) throw new BadRequestException('Informe a justificativa do cancelamento.');
      data.status = ChamadoTarefaStatus.CANCELADA;
      data.justificativa = justificativa;
      data.canceladaEm = new Date();
      acao = 'cancelada';
      detalhe = justificativa;
    } else if (dto.status === ChamadoTarefaStatus.CONCLUIDA) {
      if (encerrada) throw new BadRequestException('Tarefa concluída ou cancelada não muda de status.');
      if (!this.podeConcluir(user) && !designado) throw new ForbiddenException('Sem permissão para concluir a tarefa.');
      const texto = dto.conclusaoTexto?.trim() ?? '';
      if (texto.length < 3) throw new BadRequestException('Informe o texto de conclusão da tarefa.');
      data.status = ChamadoTarefaStatus.CONCLUIDA;
      data.conclusaoTexto = texto;
      data.concluidaEm = new Date();
      data.concluidaPor = { connect: { id: user.sub } };
      acao = 'concluida';
      detalhe = texto;
    } else if (dto.status === ChamadoTarefaStatus.EM_ANDAMENTO) {
      if (encerrada) throw new BadRequestException('Tarefa concluída ou cancelada não muda de status.');
      if (!this.podeAndamento(user) && !designado) throw new ForbiddenException('Sem permissão para registrar andamento.');
      const texto = dto.observacao?.trim() ?? '';
      if (texto.length < 3) throw new BadRequestException('Informe o registro de andamento.');
      data.status = ChamadoTarefaStatus.EM_ANDAMENTO;
      data.observacao = texto;
      acao = 'andamento';
      detalhe = texto;
    } else if (dto.status && dto.status !== before.status) {
      throw new BadRequestException('Transição de status não permitida.');
    } else if (mudaCampo) {
      acao = 'editada';
      detalhe = null;
    } else {
      throw new BadRequestException('Nenhuma alteração informada.');
    }

    if (dto.anexos?.length && acao !== 'andamento' && acao !== 'concluida' && acao !== 'cancelada') {
      throw new BadRequestException('Anexe os arquivos junto do andamento, da conclusão ou do cancelamento.');
    }

    const updated = await this.prisma.chamadoTarefa.update({ where: { id }, data, include: TAREFA_INCLUDE });
    const anexoIds = await this.gravarAnexos(updated.id, dto.anexos ?? [], user);
    const atual = anexoIds.length ? await this.requireTarefa(id) : updated;
    await this.registrarTrilha(atual, user, acao, detalhe, before.status, anexoIds);
    return this.detalhe(atual, user);
  }

  async anexar(id: string, dto: AnexoChamadoTarefaDto, user: JwtPayload) {
    const tarefa = await this.requireTarefa(id);
    const designado = tarefa.responsavelId === user.sub || (await this.ehMembro(tarefa.equipeId, user.sub));
    if (!this.podeAndamento(user) && !this.podeConcluir(user) && !designado) {
      throw new ForbiddenException('Sem permissão para anexar nesta tarefa.');
    }
    if (TAREFA_STATUS_FINAIS.includes(tarefa.status as (typeof TAREFA_STATUS_FINAIS)[number])) {
      throw new BadRequestException('Tarefa encerrada não recebe anexo.');
    }
    const anexoIds = await this.gravarAnexos(id, [dto], user);
    const atual = await this.requireTarefa(id);
    await this.registrarTrilha(atual, user, 'anexo', dto.nome?.trim() || 'anexo', tarefa.status, anexoIds);
    return this.detalhe(atual, user);
  }

  async listExecucao(query: Record<string, string | undefined>, user: JwtPayload) {
    if (!this.podeVerExecucao(user)) throw new ForbiddenException('Sem permissão para a aba de tarefas.');
    const where = this.whereExecucao(query, user);
    const items = await this.prisma.chamadoTarefa.findMany({
      where,
      include: TAREFA_INCLUDE,
      orderBy: [{ prazo: 'asc' }, { createdAt: 'desc' }],
      take: 300,
    });
    const equipes = await this.equipeIdsDoUsuario(user.sub);
    const serializados = items.map((item) => this.serialize(item, user, equipes));
    const agora = new Date();
    return {
      total: serializados.length,
      contadores: {
        novas: serializados.filter((item) => item.status === 'NOVA').length,
        emAndamento: serializados.filter((item) => item.status === 'EM_ANDAMENTO' || item.status === 'VISUALIZADA').length,
        atrasadas: serializados.filter((item) => item.atrasada).length,
      },
      items: serializados.sort((a, b) => Number(b.atrasada) - Number(a.atrasada) || prazoCmp(a.prazo, b.prazo) || b.createdAt.localeCompare(a.createdAt)),
      geradoEm: agora.toISOString(),
    };
  }

  async relatorio(query: Record<string, string | undefined>, user: JwtPayload) {
    if (!this.podeVerRelatorio(user)) throw new ForbiddenException('Sem permissão para o relatório de tarefas.');
    const where = this.whereRelatorio(query, user);
    const equipes = await this.equipeIdsDoUsuario(user.sub);
    const items = await this.prisma.chamadoTarefa.findMany({
      where,
      include: TAREFA_INCLUDE,
      orderBy: [{ prazo: 'asc' }, { createdAt: 'desc' }],
      take: 500,
    });
    const linhas = items.map((item) => {
      const row = this.serialize(item, user, equipes);
      return {
        ...row,
        situacaoPrazo: situacaoPrazoTarefa({ status: item.status, prazo: item.prazo, concluidaEm: item.concluidaEm }),
      };
    });
    const por = (chave: (item: (typeof linhas)[number]) => string) => {
      const map = new Map<string, number>();
      for (const item of linhas) {
        const nome = chave(item);
        map.set(nome, (map.get(nome) ?? 0) + 1);
      }
      return [...map.entries()].map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total);
    };
    return {
      indicadores: {
        abertas: linhas.filter((item) => !TAREFA_STATUS_FINAIS.includes(item.status as (typeof TAREFA_STATUS_FINAIS)[number])).length,
        novas: linhas.filter((item) => item.status === 'NOVA').length,
        emAndamento: linhas.filter((item) => item.status === 'EM_ANDAMENTO' || item.status === 'VISUALIZADA').length,
        impedidas: linhas.filter((item) => item.status === 'IMPEDIDA').length,
        concluidas: linhas.filter((item) => item.status === 'CONCLUIDA').length,
        atrasadas: linhas.filter((item) => item.atrasada).length,
        porSecretaria: por((item) => item.secretaria?.sigla || item.secretaria?.nome || '—'),
        porEquipe: por((item) => item.equipe?.nome || 'Sem equipe'),
        porResponsavel: por((item) => item.responsavel?.nome || 'Sem responsável'),
        porTipoChamado: por((item) => item.chamado.tipoChamado?.nome || 'Sem tipo'),
      },
      items: linhas,
    };
  }

  private whereExecucao(query: Record<string, string | undefined>, user: JwtPayload): Prisma.ChamadoTarefaWhereInput {
    const ids = resolveSecretariaScopeIds(user);
    const or: Prisma.ChamadoTarefaWhereInput[] = [
      { responsavelId: user.sub },
      { equipe: { membros: { some: { usuarioId: user.sub } } } },
    ];
    if (!ids) or.push({});
    else if (ids.length) or.push({ secretariaId: { in: ids } });
    const and: Prisma.ChamadoTarefaWhereInput[] = [{ chamado: { excluidoEm: null } }, { OR: or }];
    this.applyFiltros(and, query, user);
    if (query.historico !== '1' && !query.status) {
      and.push({ status: { in: [...TAREFA_STATUS_PENDENTES] } });
    }
    return { AND: and };
  }

  private whereRelatorio(query: Record<string, string | undefined>, user: JwtPayload): Prisma.ChamadoTarefaWhereInput {
    const ids = resolveSecretariaScopeIds(user);
    const and: Prisma.ChamadoTarefaWhereInput[] = [{ chamado: { excluidoEm: null } }];
    if (ids) and.push(ids.length ? { secretariaId: { in: ids } } : { id: { in: [] } });
    this.applyFiltros(and, query, user);
    if (query.chamadoId) and.push({ chamadoId: query.chamadoId });
    return { AND: and };
  }

  private applyFiltros(and: Prisma.ChamadoTarefaWhereInput[], query: Record<string, string | undefined>, user: JwtPayload) {
    if (query.status) and.push({ status: query.status as ChamadoTarefaStatus });
    if (query.equipeId) and.push({ equipeId: query.equipeId });
    if (query.responsavelId) and.push({ responsavelId: query.responsavelId });
    if (query.secretariaId) and.push({ secretariaId: query.secretariaId });
    if (query.prioridade) and.push({ prioridade: query.prioridade as ChamadoPrioridade });
    if (query.tipoChamadoId) and.push({ chamado: { tipoChamadoId: query.tipoChamadoId } });
    if (query.atribuidaAMim === '1') and.push({ responsavelId: user.sub });
    if (query.minhasEquipes === '1') and.push({ equipe: { membros: { some: { usuarioId: user.sub } } } });
    if (query.atrasadas === '1') {
      and.push({ status: { in: [...TAREFA_STATUS_PENDENTES] }, prazo: { lt: new Date() } });
    }
    if (query.prazoFrom || query.prazoTo) {
      and.push({
        prazo: {
          ...(query.prazoFrom ? { gte: new Date(query.prazoFrom) } : {}),
          ...(query.prazoTo ? { lte: new Date(query.prazoTo) } : {}),
        },
      });
    }
    const search = query.search?.trim();
    if (search) {
      and.push({
        OR: [
          { titulo: { contains: search, mode: 'insensitive' } },
          { chamado: { codigo: { contains: search, mode: 'insensitive' } } },
          { chamado: { titulo: { contains: search, mode: 'insensitive' } } },
        ],
      });
    }
  }

  private async detalhe(tarefa: TarefaLoaded, user: JwtPayload, equipes?: Set<string>) {
    const historico = await this.prisma.historicoStatus.findMany({
      where: { entidadeTipo: 'ChamadoTarefa', entidadeId: tarefa.id },
      orderBy: { createdAt: 'asc' },
      include: { alteradoPor: { select: { id: true, nome: true } } },
    });
    return {
      ...this.serialize(tarefa, user, equipes ?? (await this.equipeIdsDoUsuario(user.sub))),
      historico: historico.map((item) => {
        const meta = item.metadata && typeof item.metadata === 'object' && !Array.isArray(item.metadata)
          ? (item.metadata as Record<string, unknown>)
          : {};
        const anexoIds = Array.isArray(meta.anexoIds) ? meta.anexoIds.filter((id): id is string => typeof id === 'string') : [];
        return {
          id: item.id,
          motivo: item.motivo,
          statusAnterior: item.statusAnterior,
          statusNovo: item.statusNovo,
          createdAt: item.createdAt.toISOString(),
          alteradoPor: item.alteradoPor,
          acao: typeof meta.acao === 'string' ? meta.acao : null,
          perfil: typeof meta.perfilAtivo === 'string' ? meta.perfilAtivo : null,
          secretaria: typeof meta.secretariaAtiva === 'string' ? meta.secretariaAtiva : null,
          temAnexos: meta.temAnexos === true || anexoIds.length > 0,
          anexoIds,
        };
      }),
    };
  }

  private serialize(tarefa: TarefaLoaded, user: JwtPayload, equipesDoUsuario: Set<string> = new Set()) {
    const lat = num(tarefa.chamado.latitude) ?? num(tarefa.chamado.unidade?.latitude);
    const lng = num(tarefa.chamado.longitude) ?? num(tarefa.chamado.unidade?.longitude);
    return {
      id: tarefa.id,
      titulo: tarefa.titulo,
      descricao: tarefa.descricao,
      prazo: tarefa.prazo?.toISOString() ?? null,
      prioridade: tarefa.prioridade,
      status: tarefa.status,
      justificativa: tarefa.justificativa,
      conclusaoTexto: tarefa.conclusaoTexto,
      observacao: tarefa.observacao,
      atrasada: tarefaAtrasada(tarefa.status, tarefa.prazo),
      createdAt: tarefa.createdAt.toISOString(),
      concluidaEm: tarefa.concluidaEm?.toISOString() ?? null,
      visualizadaEm: tarefa.visualizadaEm?.toISOString() ?? null,
      secretaria: tarefa.secretaria,
      equipe: tarefa.equipe,
      responsavel: tarefa.responsavel,
      criadaPor: tarefa.criadaPor,
      concluidaPor: tarefa.concluidaPor,
      anexos: tarefa.anexos.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
      podeAlterarDados: this.podeAlterar(user) && !encerradaTarefa(tarefa.status),
      podeAndamento: (this.podeAndamento(user) || designadoTarefa(tarefa, user, equipesDoUsuario)) && !encerradaTarefa(tarefa.status),
      podeConcluir: (this.podeConcluir(user) || designadoTarefa(tarefa, user, equipesDoUsuario)) && !encerradaTarefa(tarefa.status),
      podeCancelar: this.podeCancelar(user) && !encerradaTarefa(tarefa.status),
      podeVerHistorico: true,
      podeTratar:
        (!encerradaTarefa(tarefa.status) &&
          (designadoTarefa(tarefa, user, equipesDoUsuario) || this.podeAlterar(user) || this.podeAndamento(user) || this.podeConcluir(user))) ||
        false,
      chamado: {
        id: tarefa.chamado.id,
        codigo: tarefa.chamado.codigo,
        titulo: tarefa.chamado.titulo,
        descricao: tarefa.chamado.descricao,
        status: tarefa.chamado.status,
        prioridade: tarefa.chamado.prioridade,
        enderecoTexto: tarefa.chamado.enderecoTexto,
        prazoEm: tarefa.chamado.prazoEm?.toISOString() ?? null,
        latitude: lat,
        longitude: lng,
        tipoChamado: tarefa.chamado.tipoChamado,
        unidade: tarefa.chamado.unidade
          ? { id: tarefa.chamado.unidade.id, nome: tarefa.chamado.unidade.nome, endereco: tarefa.chamado.unidade.endereco }
          : null,
        secretaria: tarefa.chamado.secretaria,
        equipe: tarefa.chamado.equipe,
      },
    };
  }

  private async registrarTrilha(
    tarefa: TarefaLoaded,
    user: JwtPayload,
    acao: string,
    detalhe: string | null,
    statusAnterior?: string | null,
    anexoIds: string[] = [],
  ) {
    const contexto = await this.contextoAtuacao(user);
    const motivo = motivoTarefa(acao, tarefa.titulo);
    const metadata = {
      tipo: 'tarefa',
      tarefaId: tarefa.id,
      tarefaTitulo: tarefa.titulo,
      acao,
      status: tarefa.status,
      prazo: tarefa.prazo?.toISOString() ?? null,
      equipe: tarefa.equipe?.nome ?? null,
      responsavel: tarefa.responsavel?.nome ?? null,
      secretaria: tarefa.secretaria.sigla,
      perfilAtivo: contexto.perfilNome,
      secretariaAtiva: contexto.secretariaLabel,
      secretariaAtivaId: contexto.secretariaId,
      secretariaAtivaSigla: contexto.secretariaSigla,
      temAnexos: anexoIds.length > 0,
      anexoIds,
      resumo: [
        `Status: ${tarefa.status}`,
        tarefa.equipe?.nome ? `Equipe: ${tarefa.equipe.nome}` : null,
        tarefa.responsavel?.nome ? `Responsável: ${tarefa.responsavel.nome}` : null,
        tarefa.prazo ? `Prazo: ${tarefa.prazo.toLocaleString('pt-BR')}` : null,
        detalhe,
      ]
        .filter(Boolean)
        .join(' · '),
    };
    await this.prisma.historicoStatus.create({
      data: {
        entidadeTipo: 'Chamado',
        entidadeId: tarefa.chamadoId,
        statusAnterior: tarefa.chamado.status,
        statusNovo: tarefa.chamado.status,
        motivo,
        alteradoPorId: user.sub,
        metadata,
      },
    });
    await this.prisma.historicoStatus.create({
      data: {
        entidadeTipo: 'ChamadoTarefa',
        entidadeId: tarefa.id,
        statusAnterior: statusAnterior ?? null,
        statusNovo: tarefa.status,
        motivo,
        alteradoPorId: user.sub,
        metadata,
      },
    });
    await this.audit.record({
      user,
      acao: acao === 'criada' ? AuditAction.CREATE : AuditAction.STATUS_CHANGE,
      entidadeTipo: 'ChamadoTarefa',
      entidadeId: tarefa.id,
      tela: 'chamados',
      funcao: 'tarefas',
      descricao: motivo,
      valorNovo: {
        chamadoId: tarefa.chamadoId,
        tarefaId: tarefa.id,
        acao,
        status: tarefa.status,
      },
    });
  }

  private async gravarAnexos(tarefaId: string, anexos: AnexoChamadoTarefaDto[], user: JwtPayload) {
    const ids: string[] = [];
    for (const anexo of anexos) {
      const parsed = parseDataUrl(anexo.dataUrl);
      const stored = await this.storage.persistBuffer(parsed.buffer, parsed.mime, 'tarefas');
      const criado = await this.prisma.chamadoTarefaAnexo.create({
        data: {
          tarefaId,
          nome: anexo.nome?.trim() || 'anexo',
          url: stored.url,
          storageKey: stored.storageKey,
          mimeType: stored.mimeType,
          tamanhoBytes: stored.tamanhoBytes,
          criadoPorId: user.sub,
        },
        select: { id: true },
      });
      ids.push(criado.id);
    }
    return ids;
  }

  private async contextoAtuacao(user: JwtPayload) {
    const [perfil, secretaria] = await Promise.all([
      user.perfilAtivoId
        ? this.prisma.perfil.findUnique({ where: { id: user.perfilAtivoId }, select: { nome: true } })
        : Promise.resolve(null),
      user.secretariaId
        ? this.prisma.secretaria.findUnique({ where: { id: user.secretariaId }, select: { id: true, nome: true, sigla: true } })
        : Promise.resolve(null),
    ]);
    const perfilNome = perfil?.nome ?? user.perfis?.[0] ?? null;
    return {
      perfilNome,
      secretariaId: secretaria?.id ?? user.secretariaId ?? null,
      secretariaSigla: secretaria?.sigla ?? null,
      secretariaLabel: secretaria ? `${secretaria.sigla} — ${secretaria.nome}` : null,
    };
  }

  private async validarAtribuicao(secretariaId: string, equipeId: string | null, responsavelId: string | null) {
    const secretaria = await this.prisma.secretaria.findFirst({ where: { id: secretariaId, ativo: true }, select: { id: true } });
    if (!secretaria) throw new BadRequestException('Secretaria da tarefa inválida.');
    if (equipeId) {
      const equipe = await this.prisma.equipe.findFirst({
        where: { id: equipeId, secretariaId, ativo: true },
        select: { id: true },
      });
      if (!equipe) throw new BadRequestException('A equipe precisa pertencer à secretaria da tarefa.');
    }
    if (responsavelId) {
      const usuario = await this.prisma.usuario.findFirst({ where: { id: responsavelId, ativo: true }, select: { id: true } });
      if (!usuario) throw new BadRequestException('Responsável inválido.');
      if (equipeId) {
        const membro = await this.ehMembro(equipeId, responsavelId);
        if (!membro) throw new BadRequestException('O responsável precisa ser membro da equipe escolhida.');
      }
    }
  }

  private async requireChamadoOperacional(id: string, user: JwtPayload) {
    const chamado = await this.prisma.chamado.findFirst({
      where: { id, excluidoEm: null, ...resolveChamadoSecretariaFilter(user) },
      select: { id: true, codigo: true, status: true },
    });
    if (!chamado) throw new NotFoundException('Chamado não encontrado.');
    return chamado;
  }

  private async requireTarefa(id: string) {
    const tarefa = await this.prisma.chamadoTarefa.findFirst({
      where: { id, chamado: { excluidoEm: null } },
      include: TAREFA_INCLUDE,
    });
    if (!tarefa) throw new NotFoundException('Tarefa não encontrada.');
    return tarefa;
  }

  private async podeVer(tarefa: TarefaLoaded, user: JwtPayload) {
    if (this.podeVerModulo(user) && this.secretariaNoEscopo(tarefa.secretariaId, user)) return true;
    if (tarefa.responsavelId === user.sub) return true;
    if (await this.ehMembro(tarefa.equipeId, user.sub)) return true;
    if (this.podeVerAtribuidas(user) && this.secretariaNoEscopo(tarefa.secretariaId, user)) return true;
    return false;
  }

  private async equipeIdsDoUsuario(usuarioId: string) {
    const rows = await this.prisma.equipeUsuario.findMany({ where: { usuarioId }, select: { equipeId: true } });
    return new Set(rows.map((row) => row.equipeId));
  }

  private async ehMembro(equipeId: string | null, usuarioId: string) {
    if (!equipeId) return false;
    const row = await this.prisma.equipeUsuario.findUnique({
      where: { equipeId_usuarioId: { equipeId, usuarioId } },
      select: { equipeId: true },
    });
    return Boolean(row);
  }

  private secretariaNoEscopo(secretariaId: string, user: JwtPayload) {
    const ids = resolveSecretariaScopeIds(user);
    if (!ids) return true;
    return ids.includes(secretariaId);
  }

  private chave(tela: 'chamados' | 'execucao', funcao: string, acao: 'visualizar' | 'inserir' | 'alterar' | 'executar' | 'excluir') {
    return permissionMatrixKey(tela, funcao, acao);
  }

  private tem(user: JwtPayload, legacy: string[], matrix: string[]) {
    if (isAdministradorSistema(user)) return true;
    if (legacy.some((key) => user.permissoes.includes(key))) return true;
    return hasAnyPermission(user, matrix);
  }

  private podeVerModulo(user: JwtPayload) {
    return this.tem(user, ['chamados.gerenciar'], [this.chave('chamados', 'tarefas', 'visualizar')]);
  }

  private podeVerAtribuidas(user: JwtPayload) {
    return this.tem(
      user,
      ['chamados.executar'],
      [
        this.chave('chamados', 'tarefas_atribuidas', 'visualizar'),
        this.chave('execucao', 'tarefas', 'visualizar'),
      ],
    );
  }

  private podeVerExecucao(user: JwtPayload) {
    return (
      this.podeVerModulo(user) ||
      this.podeVerAtribuidas(user) ||
      this.podeConcluir(user) ||
      this.podeAndamento(user) ||
      this.podeAlterar(user) ||
      this.tem(user, [], [this.chave('chamados', 'tarefas_historico', 'visualizar')])
    );
  }

  private podeVerRelatorio(user: JwtPayload) {
    return (
      this.podeVerModulo(user) ||
      this.tem(user, ['dashboard.visualizar'], [permissionMatrixKey('relatorios', '_tela', 'visualizar'), permissionMatrixKey('relatorios', 'exportar', 'visualizar')])
    );
  }

  private podeInserir(user: JwtPayload) {
    return this.tem(user, ['chamados.gerenciar'], [this.chave('chamados', 'tarefas', 'inserir')]);
  }

  private podeAlterar(user: JwtPayload) {
    return this.tem(user, ['chamados.gerenciar'], [this.chave('chamados', 'tarefas', 'alterar'), this.chave('execucao', 'tarefas', 'alterar')]);
  }

  private podeAndamento(user: JwtPayload) {
    return this.tem(
      user,
      ['chamados.gerenciar', 'chamados.executar'],
      [
        this.chave('chamados', 'tarefas', 'executar'),
        this.chave('chamados', 'tarefas_andamento', 'executar'),
        this.chave('execucao', 'tarefas', 'executar'),
      ],
    );
  }

  private podeConcluir(user: JwtPayload) {
    return this.tem(
      user,
      ['chamados.gerenciar', 'chamados.executar'],
      [
        this.chave('chamados', 'tarefas', 'executar'),
        this.chave('chamados', 'tarefas_concluir', 'executar'),
        this.chave('execucao', 'tarefas', 'executar'),
      ],
    );
  }

  private podeCancelar(user: JwtPayload) {
    return this.tem(user, ['chamados.gerenciar'], [this.chave('chamados', 'tarefas', 'excluir')]);
  }

  private assertPodeAtribuir(user: JwtPayload) {
    if (!this.podeInserir(user) && !this.podeAlterar(user)) {
      throw new ForbiddenException('Sem permissão para atribuir tarefa.');
    }
  }
}

function parseDataUrl(dataUrl: string) {
  const match = /^data:([^;,]+)(;base64)?,([a-z0-9+/=\r\n]+)$/i.exec(dataUrl.trim());
  if (!match || !match[2]) throw new BadRequestException('Anexo inválido.');
  const mime = normalizarMimeAnexo(match[1]);
  const buffer = Buffer.from(match[3].replace(/\s/g, ''), 'base64');
  validarBufferAnexo(mime, buffer.length);
  return { mime, buffer };
}

function num(value: { toString(): string } | null | undefined) {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function prazoCmp(a: string | null, b: string | null) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b);
}

function motivoTarefa(acao: string, titulo: string) {
  if (acao === 'criada') return `Tarefa criada: ${titulo}`;
  if (acao === 'concluida') return `Tarefa concluída: ${titulo}`;
  if (acao === 'impedida') return `Tarefa impedida: ${titulo}`;
  if (acao === 'cancelada') return `Tarefa cancelada: ${titulo}`;
  if (acao === 'andamento') return `Andamento da tarefa: ${titulo}`;
  if (acao === 'visualizada') return `Tarefa visualizada: ${titulo}`;
  if (acao === 'editada') return `Dados da tarefa alterados: ${titulo}`;
  if (acao === 'anexo') return `Anexo da tarefa: ${titulo}`;
  if (acao === 'prazo') return `Prazo da tarefa atualizado: ${titulo}`;
  if (acao === 'atribuicao') return `Atribuição da tarefa atualizada: ${titulo}`;
  return `Tarefa atualizada: ${titulo}`;
}

function encerradaTarefa(status: string) {
  return TAREFA_STATUS_FINAIS.includes(status as (typeof TAREFA_STATUS_FINAIS)[number]);
}

function designadoTarefa(tarefa: TarefaLoaded, user: JwtPayload, equipesDoUsuario: Set<string>) {
  return tarefa.responsavelId === user.sub || (tarefa.equipeId ? equipesDoUsuario.has(tarefa.equipeId) : false);
}

function criadoResumo(tarefa: TarefaLoaded) {
  return [
    tarefa.equipe?.nome ? `Equipe: ${tarefa.equipe.nome}` : null,
    tarefa.responsavel?.nome ? `Responsável: ${tarefa.responsavel.nome}` : null,
    tarefa.prazo ? `Prazo: ${tarefa.prazo.toLocaleString('pt-BR')}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}
