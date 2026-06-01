import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { resolveJwtSecret } from '../config/env';
import { hashPassword, verifyPassword } from './password';
import { signJwt } from './jwt';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async login(email: string, password: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: {
        id: true,
        nome: true,
        email: true,
        senhaHash: true,
        ativo: true,
        secretaria: {
          select: {
            id: true,
            nome: true,
            sigla: true,
          },
        },
        perfis: {
          select: {
            perfil: {
              select: {
                nome: true,
                permissoes: {
                  select: {
                    permissao: {
                      select: {
                        chave: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!usuario || !usuario.ativo || !verifyPassword(password, usuario.senhaHash)) {
      throw new UnauthorizedException('Credenciais invalidas');
    }

    const perfis = usuario.perfis.map((item) => item.perfil.nome);
    const permissoes = Array.from(
      new Set(
        usuario.perfis.flatMap((item) =>
          item.perfil.permissoes.map((perfilPermissao) => perfilPermissao.permissao.chave),
        ),
      ),
    ).sort();

    const user = {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      secretaria: usuario.secretaria,
      perfis,
      permissoes,
    };

    const accessToken = signJwt(
      {
        sub: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfis,
        permissoes,
      },
      this.getJwtSecret(),
    );

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoLoginAt: new Date() },
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresInSeconds: 60 * 60 * 8,
      user,
    };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
      select: { id: true, senhaHash: true, ativo: true },
    });

    if (!usuario || !usuario.ativo || !verifyPassword(currentPassword, usuario.senhaHash)) {
      throw new UnauthorizedException('Senha atual invalida');
    }

    if (newPassword.trim().length < 12) {
      throw new BadRequestException('Nova senha deve ter pelo menos 12 caracteres.');
    }

    await this.prisma.usuario.update({
      where: { id: userId },
      data: { senhaHash: hashPassword(newPassword.trim()) },
    });

    return { ok: true };
  }

  private getJwtSecret() {
    return resolveJwtSecret(this.configService.get<string>('JWT_SECRET'));
  }
}
