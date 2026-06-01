import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { JwtPayload } from '../auth/jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LgpdService {
  constructor(private readonly prisma: PrismaService) {}

  async anonymizeUsuario(usuarioId: string, user: JwtPayload) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario) throw new NotFoundException('Usuario nao encontrado');

    const anonymizedEmail = `anonimo+${usuarioId.slice(0, 8)}@gestop.local`;
    const updated = await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: {
        nome: 'Usuario anonimizado',
        email: anonymizedEmail,
        cpf: null,
        telefone: null,
        cargo: null,
        ativo: false,
      },
    });

    await this.prisma.logAuditoria.create({
      data: {
        usuarioId: user.sub,
        acao: AuditAction.UPDATE,
        entidadeTipo: 'Usuario',
        entidadeId: usuarioId,
        valorAntigo: { email: usuario.email, nome: usuario.nome },
        valorNovo: { anonimizado: true },
      },
    });

    return { ok: true, usuarioId: updated.id };
  }

  async purgeAuditoria(user: JwtPayload) {
    const retentionDays = Number(process.env.LGPD_AUDIT_RETENTION_DAYS ?? 365);
    if (!Number.isFinite(retentionDays) || retentionDays < 30) {
      throw new BadRequestException('LGPD_AUDIT_RETENTION_DAYS invalido (minimo 30).');
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const result = await this.prisma.logAuditoria.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    await this.prisma.logAuditoria.create({
      data: {
        usuarioId: user.sub,
        acao: AuditAction.DELETE,
        entidadeTipo: 'LogAuditoria',
        entidadeId: 'purge-retention',
        valorNovo: { removidos: result.count, retentionDays, cutoff: cutoff.toISOString() },
      },
    });

    return { removidos: result.count, retentionDays, cutoff: cutoff.toISOString() };
  }
}
