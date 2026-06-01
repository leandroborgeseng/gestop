import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { JwtPayload } from '../auth/jwt';
import { hashPassword } from '../auth/password';
import { PrismaService } from '../prisma/prisma.service';
import { SecretariaDto, UnidadeDto, UsuarioDto } from './admin.dto';
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
        ativo: dto.ativo ?? true,
      },
    });

    await this.audit(user, AuditAction.CREATE, 'UnidadePublica', unidade.id, null, unidade);
    return unidade;
  }

  async updateUnidade(id: string, dto: UnidadeDto, user: JwtPayload) {
    ensureCoordinatesOrThrow(dto.latitude, dto.longitude);
    const before = await this.getUnidadeOrThrow(id);
    const unidade = await this.prisma.unidadePublica.update({
      where: { id },
      data: {
        secretariaId: dto.secretariaId,
        codigoPatrimonial: dto.codigoPatrimonial.trim().toUpperCase(),
        nome: dto.nome.trim(),
        tipo: dto.tipo,
        endereco: dto.endereco.trim(),
        bairro: dto.bairro?.trim() ?? null,
        cep: dto.cep?.trim() ?? null,
        latitude: dto.latitude,
        longitude: dto.longitude,
        raioValidacaoMetros: dto.raioValidacaoMetros ?? 200,
        ativo: dto.ativo ?? true,
      },
    });

    await this.audit(user, AuditAction.UPDATE, 'UnidadePublica', id, before, unidade);
    return unidade;
  }

  async deleteUnidade(id: string, user: JwtPayload) {
    const before = await this.getUnidadeOrThrow(id);
    const unidade = await this.prisma.unidadePublica.update({
      where: { id },
      data: { ativo: false },
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
      },
    });
  }

  listPerfis() {
    return this.prisma.perfil.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
      include: {
        permissoes: {
          include: {
            permissao: true,
          },
        },
      },
    });
  }

  async createUsuario(dto: UsuarioDto, user: JwtPayload) {
    const isProduction = process.env.NODE_ENV === 'production';
    const senha = dto.senha?.trim();

    if (isProduction && !senha) {
      throw new BadRequestException('Senha inicial obrigatoria em producao.');
    }

    const resolvedPassword = senha || 'Gestop@123';
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
    } satisfies Prisma.UsuarioSelect;
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
