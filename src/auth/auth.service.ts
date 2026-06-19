import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { resolveJwtSecret } from '../config/env';
import { hashPassword, verifyPassword } from './password';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH_NEW } from './password-policy';
import { signJwt } from './jwt';

const USER_SESSION_SELECT = {
  id: true,
  nome: true,
  email: true,
  senhaHash: true,
  ativo: true,
  secretariaId: true,
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
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async login(email: string, password: string, remember?: boolean) {
    if (password.length > PASSWORD_MAX_LENGTH) {
      throw new UnauthorizedException('Credenciais invalidas');
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: USER_SESSION_SELECT,
    });

    if (!usuario || !usuario.ativo || !verifyPassword(password, usuario.senhaHash)) {
      throw new UnauthorizedException('Credenciais invalidas');
    }

    const { perfis, permissoes } = this.extractPerfisPermissoes(usuario);
    const user = {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      secretaria: usuario.secretaria,
      perfis,
      permissoes,
    };

    const expiresInSeconds = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 8;

    const accessToken = signJwt(
      {
        sub: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfis,
        permissoes,
      },
      this.getJwtSecret(),
      expiresInSeconds,
    );

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoLoginAt: new Date() },
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresInSeconds,
      user,
    };
  }

  async resolveActiveSession(userId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        ativo: true,
        secretariaId: true,
        perfis: USER_SESSION_SELECT.perfis,
      },
    });

    if (!usuario?.ativo) {
      throw new UnauthorizedException('Sessao invalida ou expirada');
    }

    const { perfis, permissoes } = this.extractPerfisPermissoes(usuario);
    return {
      perfis,
      permissoes,
      secretariaId: usuario.secretariaId,
    };
  }

  async getUserProfile(userId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nome: true,
        email: true,
        ativo: true,
        secretaria: USER_SESSION_SELECT.secretaria,
        perfis: USER_SESSION_SELECT.perfis,
      },
    });

    if (!usuario?.ativo) {
      throw new UnauthorizedException('Sessao invalida ou expirada');
    }

    const { perfis, permissoes } = this.extractPerfisPermissoes(usuario);
    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      secretaria: usuario.secretaria,
      perfis,
      permissoes,
    };
  }

  private extractPerfisPermissoes(usuario: {
    perfis: Array<{
      perfil: {
        nome: string;
        permissoes: Array<{ permissao: { chave: string } }>;
      };
    }>;
  }) {
    const perfis = usuario.perfis.map((item) => item.perfil.nome);
    const permissoes = Array.from(
      new Set(
        usuario.perfis.flatMap((item) =>
          item.perfil.permissoes.map((perfilPermissao) => perfilPermissao.permissao.chave),
        ),
      ),
    ).sort();

    return { perfis, permissoes };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
      select: { id: true, senhaHash: true, ativo: true },
    });

    if (!usuario || !usuario.ativo || !verifyPassword(currentPassword, usuario.senhaHash)) {
      throw new UnauthorizedException('Senha atual invalida');
    }

    if (newPassword.trim().length < PASSWORD_MIN_LENGTH_NEW) {
      throw new BadRequestException(`Nova senha deve ter pelo menos ${PASSWORD_MIN_LENGTH_NEW} caracteres.`);
    }

    if (newPassword.length > PASSWORD_MAX_LENGTH) {
      throw new BadRequestException(`Nova senha deve ter no maximo ${PASSWORD_MAX_LENGTH} caracteres.`);
    }

    await this.prisma.usuario.update({
      where: { id: userId },
      data: { senhaHash: hashPassword(newPassword.trim()) },
    });

    return { ok: true };
  }

  async requestPasswordReset(email: string) {
    const normalizedEmail = email.toLowerCase().trim();
    const usuario = await this.prisma.usuario.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, ativo: true, email: true, nome: true },
    });

    const genericResponse = {
      ok: true,
      message: 'Se o e-mail existir, enviaremos instrucoes de recuperacao.',
    };

    if (!usuario || !usuario.ativo) {
      return genericResponse;
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.prisma.$transaction([
      this.prisma.passwordResetToken.updateMany({
        where: { usuarioId: usuario.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.passwordResetToken.create({
        data: { usuarioId: usuario.id, tokenHash, expiresAt },
      }),
    ]);

    const resetUrl = `${process.env.FRONTEND_PUBLIC_URL ?? 'http://localhost:3000'}/redefinir-senha?token=${rawToken}`;
    await this.dispatchPasswordResetEmail(usuario.email, usuario.nome, resetUrl);

    const isDev = process.env.NODE_ENV !== 'production';
    return {
      ...genericResponse,
      ...(isDev ? { devResetUrl: resetUrl } : {}),
    };
  }

  async resetPasswordWithToken(token: string, newPassword: string) {
    if (newPassword.trim().length < PASSWORD_MIN_LENGTH_NEW) {
      throw new BadRequestException(`Nova senha deve ter pelo menos ${PASSWORD_MIN_LENGTH_NEW} caracteres.`);
    }

    if (newPassword.length > PASSWORD_MAX_LENGTH) {
      throw new BadRequestException(`Nova senha deve ter no maximo ${PASSWORD_MAX_LENGTH} caracteres.`);
    }

    const tokenHash = createHash('sha256').update(token.trim()).digest('hex');
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { usuario: { select: { id: true, ativo: true } } },
    });

    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now() || !record.usuario.ativo) {
      throw new BadRequestException('Token invalido ou expirado.');
    }

    await this.prisma.$transaction([
      this.prisma.usuario.update({
        where: { id: record.usuarioId },
        data: { senhaHash: hashPassword(newPassword.trim()) },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { ok: true };
  }

  private async dispatchPasswordResetEmail(email: string, nome: string, resetUrl: string) {
    const result = await this.emailService.send({
      to: email,
      subject: 'SIGMA — Redefinir senha',
      text: [
        `Ola, ${nome}.`,
        '',
        'Recebemos uma solicitacao para redefinir sua senha no SIGMA.',
        `Acesse o link abaixo (valido por 1 hora):`,
        resetUrl,
        '',
        'Se voce nao solicitou, ignore este e-mail.',
      ].join('\n'),
      html: [
        `<p>Ola, <strong>${nome}</strong>.</p>`,
        `<p>Recebemos uma solicitacao para redefinir sua senha no SIGMA.</p>`,
        `<p><a href="${resetUrl}">Redefinir senha</a> (valido por 1 hora)</p>`,
        `<p>Se voce nao solicitou, ignore este e-mail.</p>`,
      ].join(''),
      tags: ['password-reset'],
    });

    if (!result.delivered && process.env.NODE_ENV !== 'production') {
      console.log(`[SIGMA:auth] Reset URL para ${email}: ${resetUrl}`);
    }
  }

  private getJwtSecret() {
    return resolveJwtSecret(this.configService.get<string>('JWT_SECRET'));
  }
}
