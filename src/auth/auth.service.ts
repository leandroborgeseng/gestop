import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { resolveJwtSecret } from '../config/env';
import { hashPassword, verifyPassword } from './password';
import { PASSWORD_MAX_LENGTH, validatePasswordPolicy } from './password-policy';
import { JwtPayload, signJwt } from './jwt';

const SECRETARIA_SELECT = {
  id: true,
  nome: true,
  sigla: true,
} as const;

const PERFIL_SESSION_SELECT = {
  id: true,
  nome: true,
  ativo: true,
  permissoes: {
    select: {
      permissao: {
        select: { chave: true },
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
      select: this.userSessionSelect(),
    });

    if (!usuario || !usuario.ativo || !verifyPassword(password, usuario.senhaHash)) {
      throw new UnauthorizedException('Credenciais invalidas');
    }

    const session = this.buildSessionPayload(usuario);
    const expiresInSeconds = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 8;

    const accessToken = signJwt(
      {
        sub: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfis: session.perfis,
        permissoes: session.permissoes,
        secretariaId: session.secretariaId,
        perfilAtivoId: session.perfilAtivo?.id ?? null,
        acessoTodasSecretarias: session.acessoTodasSecretarias,
        secretariasIds: session.secretariasDisponiveis.map((item) => item.id),
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
      user: session.user,
    };
  }

  async resolveActiveSession(userId: string): Promise<{
    perfis: string[];
    permissoes: string[];
    secretariaId: string | null;
    perfilAtivoId: string | null;
    acessoTodasSecretarias: boolean;
    secretariasIds: string[];
  }> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
      select: this.userSessionSelect(),
    });

    if (!usuario?.ativo) {
      throw new UnauthorizedException('Sessao invalida ou expirada');
    }

    const session = this.buildSessionPayload(usuario);
    return {
      perfis: session.perfis,
      permissoes: session.permissoes,
      secretariaId: session.secretariaId,
      perfilAtivoId: session.perfilAtivo?.id ?? null,
      acessoTodasSecretarias: session.acessoTodasSecretarias,
      secretariasIds: session.secretariasDisponiveis.map((item) => item.id),
    };
  }

  async getUserProfile(userId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
      select: this.userSessionSelect(),
    });

    if (!usuario?.ativo) {
      throw new UnauthorizedException('Sessao invalida ou expirada');
    }

    return this.buildSessionPayload(usuario).user;
  }

  async switchPerfilAtivo(userId: string, perfilId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        id: true,
        perfilAtivoId: true,
        perfis: { select: { perfilId: true, perfil: { select: { id: true, nome: true, ativo: true } } } },
      },
    });
    if (!usuario) throw new UnauthorizedException('Sessao invalida ou expirada');

    const link = usuario.perfis.find((item) => item.perfilId === perfilId && item.perfil.ativo);
    if (!link) {
      throw new BadRequestException('Perfil não vinculado ao usuário.');
    }

    const anterior = usuario.perfis.find((item) => item.perfilId === usuario.perfilAtivoId)?.perfil.nome ?? null;

    await this.prisma.$transaction(async (tx) => {
      await tx.usuario.update({
        where: { id: userId },
        data: { perfilAtivoId: perfilId },
      });
      await tx.logAuditoria.create({
        data: {
          usuarioId: userId,
          acao: AuditAction.UPDATE,
          entidadeTipo: 'SessaoPerfil',
          entidadeId: userId,
          valorAntigo: { perfilAtivo: anterior },
          valorNovo: { perfilAtivo: link.perfil.nome, perfilId },
        },
      });
    });

    return this.getUserProfile(userId);
  }

  async switchSecretariaAtiva(userId: string, secretariaId: string | null) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        id: true,
        secretariaAtivaId: true,
        perfilAtivoId: true,
        acessoTodasSecretarias: true,
        secretaria: { select: SECRETARIA_SELECT },
        secretariasVinculos: {
          select: { secretariaId: true, principal: true, secretaria: { select: SECRETARIA_SELECT } },
        },
        perfis: {
          select: {
            perfilId: true,
            perfil: {
              select: {
                nome: true,
                ativo: true,
                permissoes: { select: { permissao: { select: { chave: true } } } },
              },
            },
          },
        },
        permissoesIndividuais: {
          select: { permissao: { select: { chave: true } } },
        },
      },
    });
    if (!usuario) throw new UnauthorizedException('Sessao invalida ou expirada');

    const perfilAtivo =
      usuario.perfis.find((item) => item.perfilId === usuario.perfilAtivoId && item.perfil.ativo) ??
      usuario.perfis.find((item) => item.perfil.ativo) ??
      null;

    const sessionPerms = new Set<string>();
    if (perfilAtivo) {
      for (const pp of perfilAtivo.perfil.permissoes) sessionPerms.add(pp.permissao.chave);
    }
    for (const p of usuario.permissoesIndividuais) sessionPerms.add(p.permissao.chave);

    const canTodas =
      usuario.acessoTodasSecretarias ||
      sessionPerms.has('usuarios.gerenciar') ||
      sessionPerms.has('secretarias.todas');

    const vinculos = usuario.secretariasVinculos;
    const anteriorId = usuario.secretariaAtivaId;
    const anteriorNome =
      vinculos.find((item) => item.secretariaId === anteriorId)?.secretaria.sigla ??
      (anteriorId == null && canTodas ? 'Todas as Secretarias' : null);

    if (secretariaId == null) {
      if (!canTodas) {
        throw new BadRequestException('Usuário sem permissão para atuar em todas as secretarias.');
      }
    } else {
      const ok =
        vinculos.some((item) => item.secretariaId === secretariaId) ||
        usuario.secretaria?.id === secretariaId ||
        canTodas;
      if (!ok) {
        throw new BadRequestException('Secretaria não vinculada ao usuário.');
      }
    }

    const nova =
      secretariaId == null
        ? 'Todas as Secretarias'
        : vinculos.find((item) => item.secretariaId === secretariaId)?.secretaria.sigla ?? secretariaId;

    await this.prisma.$transaction(async (tx) => {
      await tx.usuario.update({
        where: { id: userId },
        data: { secretariaAtivaId: secretariaId },
      });
      await tx.logAuditoria.create({
        data: {
          usuarioId: userId,
          acao: AuditAction.UPDATE,
          entidadeTipo: 'SessaoSecretaria',
          entidadeId: userId,
          valorAntigo: { secretariaAtiva: anteriorNome, perfilAtivoId: usuario.perfilAtivoId },
          valorNovo: { secretariaAtiva: nova, secretariaId, perfilAtivoId: usuario.perfilAtivoId },
        },
      });
    });

    return this.getUserProfile(userId);
  }

  private userSessionSelect() {
    return {
      id: true,
      nome: true,
      email: true,
      senhaHash: true,
      ativo: true,
      secretariaId: true,
      perfilAtivoId: true,
      secretariaAtivaId: true,
      acessoTodasSecretarias: true,
      secretaria: { select: SECRETARIA_SELECT },
      secretariaAtiva: { select: SECRETARIA_SELECT },
      perfilAtivo: { select: { id: true, nome: true, ativo: true } },
      perfis: {
        select: {
          perfilId: true,
          perfil: { select: PERFIL_SESSION_SELECT },
        },
      },
      permissoesIndividuais: {
        select: {
          permissao: { select: { chave: true } },
        },
      },
      secretariasVinculos: {
        select: {
          secretariaId: true,
          principal: true,
          secretaria: { select: SECRETARIA_SELECT },
        },
      },
    } as const;
  }

  private buildSessionPayload(usuario: {
    id: string;
    nome: string;
    email: string;
    secretariaId: string | null;
    perfilAtivoId: string | null;
    secretariaAtivaId: string | null;
    acessoTodasSecretarias: boolean;
    secretaria: { id: string; nome: string; sigla: string } | null;
    secretariaAtiva: { id: string; nome: string; sigla: string } | null;
    perfilAtivo: { id: string; nome: string; ativo: boolean } | null;
    perfis: Array<{
      perfilId: string;
      perfil: {
        id: string;
        nome: string;
        ativo: boolean;
        permissoes: Array<{ permissao: { chave: string } }>;
      };
    }>;
    permissoesIndividuais: Array<{ permissao: { chave: string } }>;
    secretariasVinculos: Array<{
      secretariaId: string;
      principal: boolean;
      secretaria: { id: string; nome: string; sigla: string };
    }>;
  }) {
    const perfisAtivos = usuario.perfis.filter((item) => item.perfil.ativo);
    let perfilAtivo =
      (usuario.perfilAtivoId
        ? perfisAtivos.find((item) => item.perfilId === usuario.perfilAtivoId)?.perfil
        : null) ??
      usuario.perfilAtivo ??
      perfisAtivos[0]?.perfil ??
      null;

    if (perfilAtivo && !perfilAtivo.ativo) {
      perfilAtivo = perfisAtivos[0]?.perfil ?? null;
    }

    const perfilPermKeys =
      perfilAtivo != null
        ? perfisAtivos
            .find((item) => item.perfil.id === perfilAtivo!.id)
            ?.perfil.permissoes.map((item) => item.permissao.chave) ??
          (usuario.perfis.find((item) => item.perfil.id === perfilAtivo.id)?.perfil.permissoes.map(
            (item) => item.permissao.chave,
          ) ?? [])
        : [];

    const individKeys = usuario.permissoesIndividuais.map((item) => item.permissao.chave);
    const permissoes = Array.from(new Set([...perfilPermKeys, ...individKeys])).sort();

    const secretariasDisponiveisMap = new Map<string, { id: string; nome: string; sigla: string; principal?: boolean }>();
    for (const link of usuario.secretariasVinculos) {
      secretariasDisponiveisMap.set(link.secretariaId, {
        ...link.secretaria,
        principal: link.principal,
      });
    }
    if (usuario.secretaria) {
      const prev = secretariasDisponiveisMap.get(usuario.secretaria.id);
      secretariasDisponiveisMap.set(usuario.secretaria.id, {
        ...usuario.secretaria,
        principal: prev?.principal ?? true,
      });
    }
    const secretariasDisponiveis = [...secretariasDisponiveisMap.values()].sort((a, b) =>
      a.sigla.localeCompare(b.sigla, 'pt-BR'),
    );

    const canTodas =
      usuario.acessoTodasSecretarias ||
      permissoes.includes('usuarios.gerenciar') ||
      permissoes.includes('secretarias.todas');

    let secretariaAtiva = usuario.secretariaAtiva;
    let secretariaId: string | null = usuario.secretariaAtivaId;

    // null secretariaAtivaId + canTodas = modo Todas as Secretarias
    if (!usuario.secretariaAtivaId && canTodas) {
      secretariaAtiva = null;
      secretariaId = null;
    } else if (!secretariaAtiva) {
      secretariaAtiva =
        secretariasDisponiveis.find((item) => item.principal) ??
        secretariasDisponiveis[0] ??
        usuario.secretaria ??
        null;
      secretariaId = secretariaAtiva?.id ?? null;
    }

    const perfisDisponiveis = perfisAtivos
      .map((item) => ({ id: item.perfil.id, nome: item.perfil.nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    const user = {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      secretaria: secretariaAtiva,
      perfis: perfilAtivo ? [perfilAtivo.nome] : [],
      permissoes,
      perfilAtivo: perfilAtivo ? { id: perfilAtivo.id, nome: perfilAtivo.nome } : null,
      perfisDisponiveis,
      secretariaAtiva,
      secretariasDisponiveis,
      acessoTodasSecretarias: canTodas,
      secretariaEscopoTodas: canTodas && !secretariaId,
    };

    return {
      user,
      perfis: user.perfis,
      permissoes,
      secretariaId,
      perfilAtivo,
      acessoTodasSecretarias: canTodas,
      secretariasDisponiveis,
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

    const policyError = validatePasswordPolicy(newPassword);
    if (policyError) {
      throw new BadRequestException(policyError);
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
    const policyError = validatePasswordPolicy(newPassword);
    if (policyError) {
      throw new BadRequestException(policyError);
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
