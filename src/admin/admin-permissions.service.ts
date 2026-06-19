import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { JwtPayload } from '../auth/jwt';
import { resolveAuditUsuarioId } from '../audit/audit.util';
import {
  ADMINISTRADOR_SISTEMA_NOME,
  serializeCatalog,
} from '../domain/permissions-catalog';
import {
  buildMatrixSavePayload,
  diffMatrixPermissions,
  resolveEffectiveMatrixKeys,
} from '../domain/permissions-matrix';
import { syncPermissionsCatalog } from '../domain/permissions-sync';
import { PrismaService } from '../prisma/prisma.service';
import { PerfilCreateDto } from './admin-permissions.dto';

@Injectable()
export class AdminPermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  getCatalogo() {
    return serializeCatalog();
  }

  async listPerfisConfiguraveis() {
    const perfis = await this.prisma.perfil.findMany({
      where: {
        ativo: true,
        nome: { not: ADMINISTRADOR_SISTEMA_NOME },
      },
      orderBy: { nome: 'asc' },
      select: {
        id: true,
        nome: true,
        descricao: true,
        sistema: true,
        ativo: true,
      },
    });
    return perfis;
  }

  async getMatrizPerfil(perfilId: string) {
    const perfil = await this.getPerfilConfiguravelOrThrow(perfilId);
    const permissoes = await this.prisma.perfilPermissao.findMany({
      where: { perfilId },
      include: { permissao: true },
    });
    const storedKeys = permissoes.map((item) => item.permissao.chave);
    const effective = resolveEffectiveMatrixKeys(storedKeys);

    return {
      perfil: {
        id: perfil.id,
        nome: perfil.nome,
        descricao: perfil.descricao,
        sistema: perfil.sistema,
        ativo: perfil.ativo,
      },
      catalogo: serializeCatalog(),
      chaves: [...effective].sort(),
    };
  }

  async saveMatrizPerfil(perfilId: string, chaves: string[], user: JwtPayload) {
    const perfil = await this.getPerfilConfiguravelOrThrow(perfilId);
    const beforeStored = await this.prisma.perfilPermissao.findMany({
      where: { perfilId },
      include: { permissao: true },
    });
    const beforeKeys = resolveEffectiveMatrixKeys(beforeStored.map((item) => item.permissao.chave));
    const payload = buildMatrixSavePayload(chaves);
    const afterKeys = new Set(payload.matrixKeys);

    const changes = diffMatrixPermissions(beforeKeys, afterKeys);
    if (changes.length === 0) {
      return this.getMatrizPerfil(perfilId);
    }

    await this.ensureCatalogPermissions();

    const permissaoRecords = await this.prisma.permissao.findMany({
      where: { chave: { in: payload.allKeys } },
      select: { id: true, chave: true },
    });
    const permissaoByChave = new Map(permissaoRecords.map((item) => [item.chave, item.id]));
    const missing = payload.allKeys.filter((key) => !permissaoByChave.has(key));
    if (missing.length > 0) {
      throw new BadRequestException(`Permissões não sincronizadas: ${missing.join(', ')}`);
    }

    const usuarioId = await resolveAuditUsuarioId(this.prisma, user.sub);

    await this.prisma.$transaction(async (tx) => {
      await tx.perfilPermissao.deleteMany({ where: { perfilId } });
      await tx.perfilPermissao.createMany({
        data: payload.allKeys.map((chave) => ({
          perfilId,
          permissaoId: permissaoByChave.get(chave)!,
        })),
      });

      await tx.logAuditoria.create({
        data: {
          usuarioId,
          acao: AuditAction.UPDATE,
          entidadeTipo: 'PerfilPermissao',
          entidadeId: perfilId,
          valorAntigo: {
            perfil: perfil.nome,
            chaves: [...beforeKeys].sort(),
          },
          valorNovo: {
            perfil: perfil.nome,
            chaves: payload.matrixKeys,
            legacy: payload.legacyKeys,
            alteracoes: changes.map((change) => ({
              tela: change.telaLabel,
              funcao: change.funcaoLabel,
              acao: change.acao,
              anterior: change.anterior,
              novo: change.novo,
            })),
          },
        },
      });
    });

    return this.getMatrizPerfil(perfilId);
  }

  async createPerfil(dto: PerfilCreateDto) {
    const existing = await this.prisma.perfil.findUnique({ where: { nome: dto.nome.trim() } });
    if (existing) {
      throw new BadRequestException('Já existe um perfil com este nome.');
    }

    const perfil = await this.prisma.perfil.create({
      data: {
        nome: dto.nome.trim(),
        descricao: dto.descricao?.trim() || null,
        ativo: dto.ativo ?? true,
        sistema: false,
      },
      select: {
        id: true,
        nome: true,
        descricao: true,
        sistema: true,
        ativo: true,
      },
    });

    return perfil;
  }

  async syncCatalogPermissions() {
    const total = await syncPermissionsCatalog(this.prisma);
    return { ok: true, total };
  }

  private async ensureCatalogPermissions() {
    await syncPermissionsCatalog(this.prisma);
  }

  private async getPerfilConfiguravelOrThrow(perfilId: string) {
    const perfil = await this.prisma.perfil.findUnique({ where: { id: perfilId } });
    if (!perfil) {
      throw new NotFoundException('Perfil não encontrado');
    }
    if (perfil.nome === ADMINISTRADOR_SISTEMA_NOME) {
      throw new BadRequestException('O perfil Administrador do Sistema não é configurável nesta rotina.');
    }
    return perfil;
  }
}
