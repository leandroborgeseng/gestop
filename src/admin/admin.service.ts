import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { JwtPayload } from '../auth/jwt';
import { validatePasswordPolicy } from '../auth/password-policy';
import { hashPassword } from '../auth/password';
import { resolveAuditUsuarioId } from '../audit/audit.util';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildManualOverrideOnEdit,
  getManualOverride,
  isWebmapImported,
  mergeMetadataWithManualOverride,
} from '../../prisma/webmap-manual-override';
import {
  SecretariaDto,
  UnidadeDto,
  UsuarioDto,
  EquipeDto,
  TipoChamadoDto,
  CategoriaVistoriaDto,
  CargoDto,
  TipoProprioDto,
} from './admin.dto';
import { ensureGeoCoordinates, normalizeEmail, normalizeSigla } from './admin.rules';
import { isValidCpf, normalizeCpf } from '../common/br-documents';

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
    await this.ensureTipoProprioExiste(dto.tipo);

    const unidade = await this.prisma.unidadePublica.create({
      data: {
        secretariaId: dto.secretariaId,
        codigoPatrimonial: dto.codigoPatrimonial.trim().toUpperCase(),
        nome: dto.nome.trim(),
        tipo: dto.tipo.trim(),
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
    await this.ensureTipoProprioExiste(dto.tipo, { allowInactiveCodigo: before.tipo });
    const usuarioId = await resolveAuditUsuarioId(this.prisma, user.sub);
    const beforeMetadata = (before.metadata as Record<string, unknown> | null) ?? {};
    const shouldTrackOverride = isWebmapImported(beforeMetadata) || Boolean(getManualOverride(beforeMetadata));

    const updateData: Prisma.UnidadePublicaUpdateInput = {
      secretaria: { connect: { id: dto.secretariaId } },
      codigoPatrimonial: dto.codigoPatrimonial.trim().toUpperCase(),
      nome: dto.nome.trim(),
      tipo: dto.tipo.trim(),
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
    await this.ensureEquipeUnica(dto.codigo.trim(), dto.nome.trim(), dto.secretariaId || null);

    const equipe = await this.prisma.equipe.create({
      data: {
        secretariaId: dto.secretariaId || null,
        codigo: dto.codigo.trim().toUpperCase(),
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
    await this.ensureEquipeUnica(dto.codigo.trim(), dto.nome.trim(), dto.secretariaId || null, id);

    await this.prisma.$transaction(async (tx) => {
      await tx.equipeUsuario.deleteMany({ where: { equipeId: id } });
      await tx.equipe.update({
        where: { id },
        data: {
          secretariaId: dto.secretariaId || null,
          codigo: dto.codigo.trim().toUpperCase(),
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

  listCargos() {
    return this.prisma.cargo.findMany({
      orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
    });
  }

  async createCargo(dto: CargoDto, user: JwtPayload) {
    const cargo = await this.prisma.cargo.create({
      data: {
        nome: dto.nome.trim(),
        ativo: dto.ativo ?? true,
      },
    });

    await this.audit(user, AuditAction.CREATE, 'Cargo', cargo.id, null, cargo);
    return cargo;
  }

  async updateCargo(id: string, dto: CargoDto, user: JwtPayload) {
    const before = await this.getCargoOrThrow(id);
    const cargo = await this.prisma.cargo.update({
      where: { id },
      data: {
        nome: dto.nome.trim(),
        ativo: dto.ativo ?? true,
      },
    });

    await this.audit(user, AuditAction.UPDATE, 'Cargo', id, before, cargo);
    return cargo;
  }

  async deleteCargo(id: string, user: JwtPayload) {
    const before = await this.getCargoOrThrow(id);
    const emUso = await this.prisma.usuario.count({ where: { cargoId: id } });
    if (emUso > 0) {
      throw new BadRequestException('Cargo em uso por usuários. Inative em vez de excluir.');
    }

    await this.prisma.cargo.delete({ where: { id } });
    await this.audit(user, AuditAction.DELETE, 'Cargo', id, before, null);
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

  listTiposProprio() {
    return this.prisma.tipoProprio.findMany({
      orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
    });
  }

  async createTipoProprio(dto: TipoProprioDto, user: JwtPayload) {
    const codigo = await this.gerarCodigoTipoProprioUnico(dto.nome);
    const maiorOrdem = await this.prisma.tipoProprio.aggregate({ _max: { ordem: true } });

    const tipo = await this.prisma.tipoProprio.create({
      data: {
        codigo,
        nome: dto.nome.trim(),
        descricao: dto.descricao?.trim(),
        ativo: dto.ativo ?? true,
        sistema: false,
        ordem: (maiorOrdem._max.ordem ?? 0) + 1,
      },
    });

    await this.audit(user, AuditAction.CREATE, 'TipoProprio', tipo.id, null, tipo);
    return tipo;
  }

  async updateTipoProprio(id: string, dto: TipoProprioDto, user: JwtPayload) {
    const before = await this.getTipoProprioOrThrow(id);
    const tipo = await this.prisma.tipoProprio.update({
      where: { id },
      data: {
        // Codigo é imutável (chave usada em UnidadePublica.tipo e Checklist.unidadeTipo).
        nome: dto.nome.trim(),
        descricao: dto.descricao?.trim() ?? null,
        ativo: dto.ativo ?? true,
      },
    });

    await this.audit(user, AuditAction.UPDATE, 'TipoProprio', id, before, tipo);
    return tipo;
  }

  async deleteTipoProprio(id: string, user: JwtPayload) {
    const before = await this.getTipoProprioOrThrow(id);

    if (before.sistema) {
      throw new BadRequestException('Tipos de próprio padrão do sistema não podem ser excluídos. Inative em vez de excluir.');
    }

    const [emUsoUnidades, emUsoChecklists] = await Promise.all([
      this.prisma.unidadePublica.count({ where: { tipo: before.codigo } }),
      this.prisma.checklist.count({ where: { unidadeTipo: before.codigo } }),
    ]);
    if (emUsoUnidades > 0 || emUsoChecklists > 0) {
      // Soft-inactivate when still referenced by units/checklists.
      const tipo = await this.prisma.tipoProprio.update({
        where: { id },
        data: { ativo: false },
      });
      await this.audit(user, AuditAction.UPDATE, 'TipoProprio', id, before, tipo);
      return { ok: true, inactivated: true };
    }

    await this.prisma.tipoProprio.delete({ where: { id } });
    await this.audit(user, AuditAction.DELETE, 'TipoProprio', id, before, null);
    return { ok: true };
  }

  private async ensureTipoProprioExiste(codigo: string, opts?: { allowInactiveCodigo?: string }) {
    const normalized = codigo.trim();
    const tipo = await this.prisma.tipoProprio.findUnique({ where: { codigo: normalized } });
    if (!tipo) {
      throw new BadRequestException('Tipo de próprio inválido.');
    }
    if (!tipo.ativo && tipo.codigo !== opts?.allowInactiveCodigo) {
      throw new BadRequestException('Tipo de próprio inativo.');
    }
  }

  private async gerarCodigoTipoProprioUnico(nome: string) {
    const base =
      nome
        .trim()
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'TIPO';

    let candidato = base;
    let sufixo = 2;
    while (await this.prisma.tipoProprio.findUnique({ where: { codigo: candidato } })) {
      candidato = `${base}_${sufixo}`;
      sufixo += 1;
    }
    return candidato;
  }

  private getTipoProprioOrThrow(id: string) {
    return this.prisma.tipoProprio.findUniqueOrThrow({ where: { id } }).catch(() => {
      throw new NotFoundException('Tipo de próprio não encontrado');
    });
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

    if (senha) {
      const policyError = validatePasswordPolicy(senha);
      if (policyError) {
        throw new BadRequestException(policyError);
      }
    }

    const cpf = normalizeCpf(dto.cpf);
    if (cpf && !isValidCpf(cpf)) {
      throw new BadRequestException('CPF inválido.');
    }

    const cargoFields = await this.resolveUsuarioCargoFields(dto);

    const resolvedPassword = senha || 'Gestop@123';
    const equipeIds = dto.equipeIds ?? [];
    const usuario = await this.prisma.usuario.create({
      data: {
        secretariaId: dto.secretariaId || null,
        secretariaAtivaId: dto.secretariaId || null,
        perfilAtivoId: dto.perfilIds[0] ?? null,
        nome: dto.nome.trim(),
        email: normalizeEmail(dto.email),
        cpf,
        telefone: dto.telefone?.replace(/\D/g, '') || null,
        ...cargoFields,
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

    await this.syncUsuarioSecretarias(usuario.id, dto);
    const created = await this.getUsuarioOrThrow(usuario.id);
    await this.audit(user, AuditAction.CREATE, 'Usuario', created.id, null, this.maskUsuario(created));
    return created;
  }

  async updateUsuario(id: string, dto: UsuarioDto, user: JwtPayload) {
    const before = await this.getUsuarioOrThrow(id);

    const cpf = normalizeCpf(dto.cpf);
    if (cpf && !isValidCpf(cpf)) {
      throw new BadRequestException('CPF inválido.');
    }

    if (dto.senha?.trim()) {
      const policyError = validatePasswordPolicy(dto.senha);
      if (policyError) {
        throw new BadRequestException(policyError);
      }
    }

    const cargoFields = await this.resolveUsuarioCargoFields(dto);

    await this.prisma.$transaction(async (tx) => {
      await tx.usuarioPerfil.deleteMany({ where: { usuarioId: id } });
      await tx.equipeUsuario.deleteMany({ where: { usuarioId: id } });
      await tx.usuario.update({
        where: { id },
        data: {
          secretariaId: dto.secretariaId || null,
          nome: dto.nome.trim(),
          email: normalizeEmail(dto.email),
          cpf,
          telefone: dto.telefone?.replace(/\D/g, '') || null,
          ...cargoFields,
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

    await this.syncUsuarioSecretarias(id, dto);
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

  private getCargoOrThrow(id: string) {
    return this.prisma.cargo.findUniqueOrThrow({ where: { id } }).catch(() => {
      throw new NotFoundException('Cargo nao encontrado');
    });
  }

  private async syncUsuarioSecretarias(usuarioId: string, dto: UsuarioDto) {
    const principalId = dto.secretariaId?.trim() || null;
    const linkedIds = Array.from(
      new Set([...(dto.secretariaIds ?? []).map((id) => id.trim()).filter(Boolean), ...(principalId ? [principalId] : [])]),
    );

    const current = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { perfilAtivoId: true, secretariaAtivaId: true },
    });

    const nextPerfilAtivoId =
      current?.perfilAtivoId && dto.perfilIds.includes(current.perfilAtivoId)
        ? current.perfilAtivoId
        : (dto.perfilIds[0] ?? null);

    const nextSecretariaAtivaId =
      current?.secretariaAtivaId && linkedIds.includes(current.secretariaAtivaId)
        ? current.secretariaAtivaId
        : principalId;

    await this.prisma.$transaction(async (tx) => {
      await tx.usuarioSecretaria.deleteMany({ where: { usuarioId } });
      if (linkedIds.length > 0) {
        await tx.usuarioSecretaria.createMany({
          data: linkedIds.map((secretariaId) => ({
            usuarioId,
            secretariaId,
            principal: secretariaId === (principalId ?? linkedIds[0]),
          })),
        });
      }

      await tx.usuario.update({
        where: { id: usuarioId },
        data: {
          perfilAtivoId: nextPerfilAtivoId,
          secretariaAtivaId: nextSecretariaAtivaId,
          secretariaId: principalId,
          acessoTodasSecretarias: Boolean(dto.acessoTodasSecretarias),
        },
      });
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
      cargoId: true,
      cargoRef: { select: { id: true, nome: true, ativo: true } },
      ativo: true,
      secretariaId: true,
      acessoTodasSecretarias: true,
      secretaria: { select: { id: true, nome: true, sigla: true } },
      secretariasVinculos: {
        select: {
          principal: true,
          secretaria: { select: { id: true, nome: true, sigla: true } },
        },
      },
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

  private async ensureEquipeUnica(codigo: string, nome: string, secretariaId: string | null, excludeId?: string) {
    const normalizedCodigo = codigo.trim().toUpperCase();
    const normalizedNome = nome.trim();

    const codigoDuplicado = await this.prisma.equipe.findFirst({
      where: {
        codigo: normalizedCodigo,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (codigoDuplicado) {
      throw new BadRequestException('Já existe uma equipe com este código.');
    }

    const nomeDuplicado = await this.prisma.equipe.findFirst({
      where: {
        nome: normalizedNome,
        secretariaId,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (nomeDuplicado) {
      throw new BadRequestException('Já existe uma equipe com este nome nesta secretaria.');
    }
  }

  private async resolveUsuarioCargoFields(dto: UsuarioDto) {
    if (dto.cargoId?.trim()) {
      const cargo = await this.getCargoOrThrow(dto.cargoId.trim());
      if (!cargo.ativo) {
        throw new BadRequestException('Cargo inativo.');
      }
      return { cargoId: cargo.id, cargo: cargo.nome };
    }

    return { cargoId: null, cargo: dto.cargo?.trim() || null };
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
