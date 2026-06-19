import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { JwtPayload } from '../auth/jwt';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH_NEW } from '../auth/password-policy';
import { hashPassword } from '../auth/password';
import { resolveAuditUsuarioId } from '../audit/audit.util';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildManualOverrideOnEdit,
  getManualOverride,
  isWebmapImported,
  mergeMetadataWithManualOverride,
} from '../../prisma/webmap-manual-override';
import { SecretariaDto, UnidadeDto, UsuarioDto, EquipeDto, TipoChamadoDto, CategoriaVistoriaDto } from './admin.dto';
import { ensureGeoCoordinates, normalizeEmail, normalizeSigla } from './admin.rules';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  listSecretarias() {
    return this.prisma.secretaria.findMany({
      orderBy: { nome: 'asc' },
    });
  }

  async createSecretaria(dto: SecretariaDto, user: JwtPayload) {
    const secretaria = await this.prisma.secretaria.create({
      data: {
        nome: dto.nome.trim(),
        sigla: normalizeSigla(dto.sigla),
        descricao: dto.descricao?.trim(),
        responsavelNome: dto.responsavelNome?.trim(),
        responsavelEmail: dto.responsavelEmail ? normalizeEmail(dto.responsavelEmail) : undefined,
        ativo: dto.ativo ?? true,
      },
    });

    await this.audit(user, AuditAction.CREATE, 'Secretaria', secretaria.id, null, secretaria);
    return secretaria;
  }

  async updateSecretaria(id: string, dto: SecretariaDto, user: JwtPayload) {
    const before = await this.getSecretariaOrThrow(id);
    const secretaria = await this.prisma.secretaria.update({
      where: { id },
      data: {
        nome: dto.nome.trim(),
        sigla: normalizeSigla(dto.sigla),
        descricao: dto.descricao?.trim(),
        responsavelNome: dto.responsavelNome?.trim(),
        responsavelEmail: dto.responsavelEmail ? normalizeEmail(dto.responsavelEmail) : null,
        ativo: dto.ativo ?? true,
      },
    });

    await this.audit(user, AuditAction.UPDATE, 'Secretaria', id, before, secretaria);
    return secretaria;
  }

  async deleteSecretaria(id: string, user: JwtPayload) {
    const before = await this.getSecretariaOrThrow(id);
    const secretaria = await this.prisma.secretaria.update({
      where: { id },
      data: { ativo: false },
    });

    await this.audit(user, AuditAction.DELETE, 'Secretaria', id, before, secretaria);
    return secretaria;
  }

  listUnidades() {
    return this.prisma.unidadePublica.findMany({
      where: { ativo: true },
      orderBy: [{ secretaria: { sigla: 'asc' } }, { nome: 'asc' }],
      include: {
        secretaria: {
          select: { id: true, nome: true, sigla: true },
        },
      },
    });
  }

  async createUnidade(dto: UnidadeDto, user: JwtPayload) {
    ensureCoordinatesOrThrow(dto.latitude, dto.longitude);

    const unidade = await this.prisma.unidadePublica.create({
      data: {
        secretariaId: dto.secretariaId,
        codigoPatrimonial: dto.codigoPatrimonial.trim().toUpperCase(),
        nome: dto.nome.trim(),
        tipo: dto.tipo,
        endereco: dto.endereco.trim(),
        bairro: dto.bairro?.trim(),
        cep: dto.cep?.trim(),
        latitude: dto.latitude,
        longitude: dto.longitude,
        raioValidacaoMetros: dto.raioValidacaoMetros ?? 200,
        regiao: dto.regiao ?? null,
        ativo: dto.ativo ?? true,
      },
    });

    await this.audit(user, AuditAction.CREATE, 'UnidadePublica', unidade.id, null, unidade);
    return unidade;
  }

  async updateUnidade(id: string, dto: UnidadeDto, user: JwtPayload) {
    ensureCoordinatesOrThrow(dto.latitude, dto.longitude);
    const before = await this.getUnidadeOrThrow(id);
    const usuarioId = await resolveAuditUsuarioId(this.prisma, user.sub);
    const beforeMetadata = (before.metadata as Record<string, unknown> | null) ?? {};
    const shouldTrackOverride = isWebmapImported(beforeMetadata) || Boolean(getManualOverride(beforeMetadata));

    const updateData: Prisma.UnidadePublicaUpdateInput = {
      secretaria: { connect: { id: dto.secretariaId } },
      codigoPatrimonial: dto.codigoPatrimonial.trim().toUpperCase(),
      nome: dto.nome.trim(),
      tipo: dto.tipo,
      endereco: dto.endereco.trim(),
      bairro: dto.bairro?.trim() ?? null,
      cep: dto.cep?.trim() ?? null,
      latitude: dto.latitude,
      longitude: dto.longitude,
      raioValidacaoMetros: dto.raioValidacaoMetros ?? 200,
      regiao: dto.regiao ?? null,
      ativo: dto.ativo ?? true,
    };

    if (shouldTrackOverride) {
      const manualOverride = buildManualOverrideOnEdit(
        {
          ...before,
          latitude: Number(before.latitude),
          longitude: Number(before.longitude),
        },
        dto,
        beforeMetadata,
        usuarioId ?? 'sistema',
      );
      updateData.metadata = mergeMetadataWithManualOverride(beforeMetadata, manualOverride);
    }

    const unidade = await this.prisma.unidadePublica.update({
      where: { id },
      data: updateData,
    });

    await this.audit(user, AuditAction.UPDATE, 'UnidadePublica', id, before, unidade);
    return unidade;
  }

  async deleteUnidade(id: string, user: JwtPayload) {
    const before = await this.getUnidadeOrThrow(id);
    const usuarioId = await resolveAuditUsuarioId(this.prisma, user.sub);
    const beforeMetadata = (before.metadata as Record<string, unknown> | null) ?? {};

    const updateData: Prisma.UnidadePublicaUpdateInput = { ativo: false };

    if (isWebmapImported(beforeMetadata) || getManualOverride(beforeMetadata)) {
      const previous = getManualOverride(beforeMetadata);
      updateData.metadata = mergeMetadataWithManualOverride(beforeMetadata, {
        lockedFields: previous?.lockedFields ?? [],
        editedAt: new Date().toISOString(),
        editedBy: usuarioId ?? 'sistema',
        reason: previous?.reason ?? 'Inativação manual pós-importação QGIS',
        deactivatedManually: true,
      });
    }

    const unidade = await this.prisma.unidadePublica.update({
      where: { id },
      data: updateData,
    });

    await this.audit(user, AuditAction.DELETE, 'UnidadePublica', id, before, unidade);
    return unidade;
  }

  listUsuarios() {
    return this.prisma.usuario.findMany({
      orderBy: { nome: 'asc' },
      select: {
        id: true,
        nome: true,
        email: true,
        cpf: true,
        telefone: true,
        cargo: true,
        ativo: true,
        secretariaId: true,
        secretaria: { select: { id: true, nome: true, sigla: true } },
        perfis: {
          select: {
            perfil: { select: { id: true, nome: true } },
          },
        },
        equipes: {
          select: {
            equipe: { select: { id: true, nome: true, ativo: true } },
          },
        },
      },
    });
  }

  listEquipes() {
    return this.prisma.equipe.findMany({
      orderBy: { nome: 'asc' },
      include: {
        secretaria: { select: { id: true, nome: true, sigla: true } },
        membros: {
          select: {
            usuario: { select: { id: true, nome: true, email: true, ativo: true } },
          },
        },
        _count: { select: { chamados: true } },
      },
    });
  }

  async createEquipe(dto: EquipeDto, user: JwtPayload) {
    await this.ensureUsuariosExist(dto.usuarioIds);
    await this.ensureEquipeMembrosCoerentes(dto.secretariaId, dto.usuarioIds);

    const equipe = await this.prisma.equipe.create({
      data: {
        secretariaId: dto.secretariaId || null,
        nome: dto.nome.trim(),
        descricao: dto.descricao?.trim(),
        tipo: dto.tipo ?? 'PROPRIA',
        emailEquipe: normalizeEmail(dto.emailEquipe),
        ativo: dto.ativo ?? true,
        membros: {
          create: dto.usuarioIds.map((usuarioId) => ({
            usuario: { connect: { id: usuarioId } },
          })),
        },
      },
      include: this.equipeInclude(),
    });

    await this.audit(user, AuditAction.CREATE, 'Equipe', equipe.id, null, equipe);
    return equipe;
  }

  async updateEquipe(id: string, dto: EquipeDto, user: JwtPayload) {
    const before = await this.getEquipeOrThrow(id);
    await this.ensureUsuariosExist(dto.usuarioIds);
    await this.ensureEquipeMembrosCoerentes(dto.secretariaId, dto.usuarioIds);

    await this.prisma.$transaction(async (tx) => {
      await tx.equipeUsuario.deleteMany({ where: { equipeId: id } });
      await tx.equipe.update({
        where: { id },
        data: {
          secretariaId: dto.secretariaId || null,
          nome: dto.nome.trim(),
          descricao: dto.descricao?.trim() ?? null,
          tipo: dto.tipo ?? before.tipo,
          emailEquipe: normalizeEmail(dto.emailEquipe),
          ativo: dto.ativo ?? true,
          membros: {
            create: dto.usuarioIds.map((usuarioId) => ({
              usuario: { connect: { id: usuarioId } },
            })),
          },
        },
      });
    });

    const equipe = await this.getEquipeOrThrow(id);
    await this.audit(user, AuditAction.UPDATE, 'Equipe', id, before, equipe);
    return equipe;
  }

  async deleteEquipe(id: string, user: JwtPayload) {
    const before = await this.getEquipeOrThrow(id);
    const equipe = await this.prisma.equipe.update({
      where: { id },
      data: { ativo: false },
      include: this.equipeInclude(),
    });

    await this.audit(user, AuditAction.DELETE, 'Equipe', id, before, equipe);
    return equipe;
  }

  listCategoriasVistoria() {
    return this.prisma.categoriaVistoria.findMany({
      orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
    });
  }

  async createCategoriaVistoria(dto: CategoriaVistoriaDto, user: JwtPayload) {
    const categoria = await this.prisma.categoriaVistoria.create({
      data: {
        nome: dto.nome.trim(),
        ativo: dto.ativo ?? true,
      },
    });

    await this.audit(user, AuditAction.CREATE, 'CategoriaVistoria', categoria.id, null, categoria);
    return categoria;
  }

  async updateCategoriaVistoria(id: string, dto: CategoriaVistoriaDto, user: JwtPayload) {
    const before = await this.getCategoriaVistoriaOrThrow(id);
    const categoria = await this.prisma.categoriaVistoria.update({
      where: { id },
      data: {
        nome: dto.nome.trim(),
        ativo: dto.ativo ?? true,
      },
    });

    await this.audit(user, AuditAction.UPDATE, 'CategoriaVistoria', id, before, categoria);
    return categoria;
  }

  async deleteCategoriaVistoria(id: string, user: JwtPayload) {
    const before = await this.getCategoriaVistoriaOrThrow(id);
    const emUso = await this.prisma.checklistItem.count({ where: { categoriaVistoriaId: id } });
    if (emUso > 0) {
      throw new BadRequestException('Categoria em uso em checklists. Inative em vez de excluir.');
    }

    await this.prisma.categoriaVistoria.delete({ where: { id } });
    await this.audit(user, AuditAction.DELETE, 'CategoriaVistoria', id, before, null);
    return { ok: true };
  }

  listTiposChamado() {
    return this.prisma.tipoChamado.findMany({
      orderBy: { nome: 'asc' },
    });
  }

  async createTipoChamado(dto: TipoChamadoDto, user: JwtPayload) {
    const tipo = await this.prisma.tipoChamado.create({
      data: {
        nome: dto.nome.trim(),
        descricao: dto.descricao?.trim(),
        slaBaixaDias: dto.slaBaixaDias,
        slaMediaDias: dto.slaMediaDias,
        slaAltaDias: dto.slaAltaDias,
        slaUrgenteDias: dto.slaUrgenteDias,
        exigeVistoriaPrevia: dto.exigeVistoriaPrevia ?? false,
        ativo: dto.ativo ?? true,
      },
    });

    await this.audit(user, AuditAction.CREATE, 'TipoChamado', tipo.id, null, tipo);
    return tipo;
  }

  async updateTipoChamado(id: string, dto: TipoChamadoDto, user: JwtPayload) {
    const before = await this.getTipoChamadoOrThrow(id);
    const tipo = await this.prisma.tipoChamado.update({
      where: { id },
      data: {
        nome: dto.nome.trim(),
        descricao: dto.descricao?.trim() ?? null,
        slaBaixaDias: dto.slaBaixaDias,
        slaMediaDias: dto.slaMediaDias,
        slaAltaDias: dto.slaAltaDias,
        slaUrgenteDias: dto.slaUrgenteDias,
        exigeVistoriaPrevia: dto.exigeVistoriaPrevia ?? false,
        ativo: dto.ativo ?? true,
      },
    });

    await this.audit(user, AuditAction.UPDATE, 'TipoChamado', id, before, tipo);
    return tipo;
  }

  async deleteTipoChamado(id: string, user: JwtPayload) {
    const before = await this.getTipoChamadoOrThrow(id);
    const emUso = await this.prisma.chamado.count({ where: { tipoChamadoId: id } });
    if (emUso > 0) {
      throw new BadRequestException('Tipo de chamado em uso. Inative em vez de excluir.');
    }

    await this.prisma.tipoChamado.delete({ where: { id } });
    await this.audit(user, AuditAction.DELETE, 'TipoChamado', id, before, null);
    return { ok: true };
  }

  listPerfis() {
    return this.prisma.perfil.findMany({
      orderBy: { nome: 'asc' },
      include: {
        permissoes: {
          include: {
            permissao: true,
          },
        },
      },
    }).then((perfis) =>
      perfis.map((perfil) => ({
        id: perfil.id,
        nome: perfil.nome,
        descricao: perfil.descricao,
        sistema: perfil.sistema,
        ativo: perfil.ativo,
        permissoes: perfil.permissoes.map((item) => ({
          id: item.permissao.id,
          codigo: item.permissao.chave,
          descricao: item.permissao.descricao,
          modulo: item.permissao.modulo,
        })),
      })),
    );
  }

  async createUsuario(dto: UsuarioDto, user: JwtPayload) {
    const isProduction = process.env.NODE_ENV === 'production';
    const senha = dto.senha?.trim();

    if (isProduction && !senha) {
      throw new BadRequestException('Senha inicial obrigatoria em producao.');
    }

    if (senha && (senha.length < PASSWORD_MIN_LENGTH_NEW || senha.length > PASSWORD_MAX_LENGTH)) {
      throw new BadRequestException(
        `Senha deve ter entre ${PASSWORD_MIN_LENGTH_NEW} e ${PASSWORD_MAX_LENGTH} caracteres.`,
      );
    }

    const resolvedPassword = senha || 'Gestop@123';
    const equipeIds = dto.equipeIds ?? [];
    const usuario = await this.prisma.usuario.create({
      data: {
        secretariaId: dto.secretariaId || null,
        nome: dto.nome.trim(),
        email: normalizeEmail(dto.email),
        cpf: dto.cpf?.trim(),
        telefone: dto.telefone?.trim(),
        cargo: dto.cargo?.trim(),
        senhaHash: hashPassword(resolvedPassword),
        ativo: dto.ativo ?? true,
        perfis: {
          create: dto.perfilIds.map((perfilId) => ({
            perfil: { connect: { id: perfilId } },
          })),
        },
        equipes: {
          create: equipeIds.map((equipeId) => ({
            equipe: { connect: { id: equipeId } },
          })),
        },
      },
      select: this.usuarioSelect(),
    });

    await this.audit(user, AuditAction.CREATE, 'Usuario', usuario.id, null, this.maskUsuario(usuario));
    return usuario;
  }

  async updateUsuario(id: string, dto: UsuarioDto, user: JwtPayload) {
    const before = await this.getUsuarioOrThrow(id);

    await this.prisma.$transaction(async (tx) => {
      await tx.usuarioPerfil.deleteMany({ where: { usuarioId: id } });
      await tx.equipeUsuario.deleteMany({ where: { usuarioId: id } });
      await tx.usuario.update({
        where: { id },
        data: {
          secretariaId: dto.secretariaId || null,
          nome: dto.nome.trim(),
          email: normalizeEmail(dto.email),
          cpf: dto.cpf?.trim() ?? null,
          telefone: dto.telefone?.trim() ?? null,
          cargo: dto.cargo?.trim() ?? null,
          ...(dto.senha ? { senhaHash: hashPassword(dto.senha) } : {}),
          ativo: dto.ativo ?? true,
          perfis: {
            create: dto.perfilIds.map((perfilId) => ({
              perfil: { connect: { id: perfilId } },
            })),
          },
          equipes: {
            create: (dto.equipeIds ?? []).map((equipeId) => ({
              equipe: { connect: { id: equipeId } },
            })),
          },
        },
      });
    });

    const usuario = await this.getUsuarioOrThrow(id);
    await this.audit(user, AuditAction.UPDATE, 'Usuario', id, this.maskUsuario(before), this.maskUsuario(usuario));
    return usuario;
  }

  async deleteUsuario(id: string, user: JwtPayload) {
    const before = await this.getUsuarioOrThrow(id);
    const usuario = await this.prisma.usuario.update({
      where: { id },
      data: { ativo: false },
      select: this.usuarioSelect(),
    });

    await this.audit(user, AuditAction.DELETE, 'Usuario', id, this.maskUsuario(before), this.maskUsuario(usuario));
    return usuario;
  }

  private getSecretariaOrThrow(id: string) {
    return this.prisma.secretaria.findUniqueOrThrow({ where: { id } }).catch(() => {
      throw new NotFoundException('Secretaria nao encontrada');
    });
  }

  private getUnidadeOrThrow(id: string) {
    return this.prisma.unidadePublica.findUniqueOrThrow({ where: { id } }).catch(() => {
      throw new NotFoundException('Proprio publico nao encontrado');
    });
  }

  private getEquipeOrThrow(id: string) {
    return this.prisma.equipe.findUniqueOrThrow({ where: { id }, include: this.equipeInclude() }).catch(() => {
      throw new NotFoundException('Equipe nao encontrada');
    });
  }

  private getTipoChamadoOrThrow(id: string) {
    return this.prisma.tipoChamado.findUniqueOrThrow({ where: { id } }).catch(() => {
      throw new NotFoundException('Tipo de chamado nao encontrado');
    });
  }

  private getCategoriaVistoriaOrThrow(id: string) {
    return this.prisma.categoriaVistoria.findUniqueOrThrow({ where: { id } }).catch(() => {
      throw new NotFoundException('Categoria de vistoria nao encontrada');
    });
  }

  private getUsuarioOrThrow(id: string) {
    return this.prisma.usuario.findUniqueOrThrow({ where: { id }, select: this.usuarioSelect() }).catch(() => {
      throw new NotFoundException('Usuario nao encontrado');
    });
  }

  private usuarioSelect() {
    return {
      id: true,
      nome: true,
      email: true,
      cpf: true,
      telefone: true,
      cargo: true,
      ativo: true,
      secretariaId: true,
      secretaria: { select: { id: true, nome: true, sigla: true } },
      perfis: {
        select: {
          perfil: { select: { id: true, nome: true } },
        },
      },
      equipes: {
        select: {
          equipe: { select: { id: true, nome: true, ativo: true } },
        },
      },
    } satisfies Prisma.UsuarioSelect;
  }

  private equipeInclude() {
    return {
      secretaria: { select: { id: true, nome: true, sigla: true } },
      membros: {
        select: {
          usuario: { select: { id: true, nome: true, email: true, ativo: true } },
        },
      },
      _count: { select: { chamados: true } },
    } satisfies Prisma.EquipeInclude;
  }

  private async ensureEquipeMembrosCoerentes(secretariaId: string | null | undefined, usuarioIds: string[]) {
    if (!secretariaId || usuarioIds.length === 0) return;

    const usuarios = await this.prisma.usuario.findMany({
      where: { id: { in: usuarioIds } },
      select: { id: true, secretariaId: true },
    });

    const invalidos = usuarios.filter((usuario) => usuario.secretariaId !== secretariaId);
    if (invalidos.length > 0) {
      throw new BadRequestException('Membros devem pertencer à mesma secretaria da equipe.');
    }
  }

  private async ensureUsuariosExist(usuarioIds: string[]) {
    if (usuarioIds.length === 0) return;
    const count = await this.prisma.usuario.count({ where: { id: { in: usuarioIds } } });
    if (count !== usuarioIds.length) {
      throw new BadRequestException('Um ou mais usuarios informados nao existem.');
    }
  }

  private maskUsuario<T extends { email: string }>(usuario: T) {
    return {
      ...usuario,
      senhaHash: undefined,
    };
  }

  private audit(user: JwtPayload, acao: AuditAction, entidadeTipo: string, entidadeId: string, valorAntigo: unknown, valorNovo: unknown) {
    return this.prisma.logAuditoria.create({
      data: {
        usuarioId: user.sub,
        acao,
        entidadeTipo,
        entidadeId,
        valorAntigo: toJsonValue(valorAntigo),
        valorNovo: toJsonValue(valorNovo),
      },
    });
  }
}

function ensureCoordinatesOrThrow(latitude: number, longitude: number) {
  try {
    ensureGeoCoordinates(latitude, longitude);
  } catch (error) {
    throw new BadRequestException(error instanceof Error ? error.message : 'Coordenadas invalidas');
  }
}

function toJsonValue(value: unknown) {
  if (value === null) {
    return Prisma.JsonNull;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
