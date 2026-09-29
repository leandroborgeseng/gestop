import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { JwtPayload } from '../auth/jwt';
import { encryptSecret } from '../backup/backup-crypto';
import { PrismaService } from '../prisma/prisma.service';
import { mensagemEmailNaoConfigurado } from './email-transport';
import { EmailConfigDto, EmailTesteDto } from './email.dto';
import { EmailService } from './email.service';

const CONFIG_ID = 'default';

export type EmailPublicConfig = {
  ativo: boolean;
  remetenteEmail: string;
  remetenteNome: string;
  replyTo: string;
  smtpHost: string;
  smtpPort: number;
  seguranca: 'NENHUMA' | 'SSL' | 'TLS';
  usarAutenticacao: boolean;
  usuario: string;
  senhaDefinida: boolean;
  assuntoEquipe: string;
  textoIntroEquipe: string;
  origem: 'tela' | 'ambiente' | 'nenhuma';
};

@Injectable()
export class EmailConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly audit: AuditService,
  ) {}

  async getPublic(): Promise<EmailPublicConfig> {
    const row = await this.ensureRow();
    return this.toPublic(row);
  }

  async save(dto: EmailConfigDto, user: JwtPayload) {
    const current = await this.ensureRow();
    const before = this.toAudit(current);
    const seguranca = normalizeSeguranca(dto.seguranca);
    const senhaInformada = dto.senha?.trim() ?? '';
    let senhaEnc = current.senhaEnc;
    if (senhaInformada) senhaEnc = encryptSecret(senhaInformada);

    if (dto.ativo) {
      if (!dto.remetenteEmail?.trim() || !dto.smtpHost?.trim()) {
        throw new BadRequestException('Para ativar o e-mail, informe o remetente e o servidor SMTP.');
      }
      if (dto.usarAutenticacao && (!dto.usuario?.trim() || !senhaEnc)) {
        throw new BadRequestException('Para usar autenticação, informe usuário e senha.');
      }
    }

    const updated = await this.prisma.configuracaoEmail.update({
      where: { id: CONFIG_ID },
      data: {
        ativo: dto.ativo,
        remetenteEmail: emptyToNull(dto.remetenteEmail),
        remetenteNome: emptyToNull(dto.remetenteNome),
        replyTo: emptyToNull(dto.replyTo),
        smtpHost: emptyToNull(dto.smtpHost),
        smtpPort: dto.smtpPort,
        seguranca,
        usarAutenticacao: dto.usarAutenticacao,
        usuario: emptyToNull(dto.usuario),
        senhaEnc,
        assuntoEquipe: emptyToNull(dto.assuntoEquipe),
        textoIntroEquipe: emptyToNull(dto.textoIntroEquipe),
      },
    });

    this.emailService.invalidate();
    await this.audit.record({
      user,
      acao: AuditAction.UPDATE,
      entidadeTipo: 'ConfiguracaoEmail',
      entidadeId: CONFIG_ID,
      valorAntigo: before,
      valorNovo: this.toAudit(updated),
      descricao: 'Configuração de e-mail atualizada',
    });

    return this.toPublic(updated);
  }

  async testar(dto: EmailTesteDto, user: JwtPayload) {
    const destino = dto.destino.trim();
    const result = await this.emailService.send({
      to: destino,
      subject: 'SIGMA — teste de e-mail',
      text: 'Este é um e-mail de teste enviado pela configuração do SIGMA.',
      html: '<p>Este é um e-mail de teste enviado pela configuração do SIGMA.</p>',
      tags: ['teste-configuracao'],
    });

    if (!result.delivered || result.driver === 'log') {
      throw new BadRequestException(
        result.driver === 'log' ? mensagemEmailNaoConfigurado() : result.detail || mensagemEmailNaoConfigurado(),
      );
    }

    await this.audit.record({
      user,
      acao: AuditAction.CREATE,
      entidadeTipo: 'ConfiguracaoEmail',
      entidadeId: CONFIG_ID,
      valorNovo: { teste: true, destino },
      descricao: 'Teste de envio de e-mail',
    });

    return { ok: true, mensagem: `E-mail de teste enviado para ${destino}.` };
  }

  private async ensureRow() {
    return this.prisma.configuracaoEmail.upsert({
      where: { id: CONFIG_ID },
      update: {},
      create: { id: CONFIG_ID },
    });
  }

  private toPublic(row: {
    ativo: boolean;
    remetenteEmail: string | null;
    remetenteNome: string | null;
    replyTo: string | null;
    smtpHost: string | null;
    smtpPort: number;
    seguranca: string;
    usarAutenticacao: boolean;
    usuario: string | null;
    senhaEnc: string | null;
    assuntoEquipe: string | null;
    textoIntroEquipe: string | null;
  }): EmailPublicConfig {
    return {
      ativo: row.ativo,
      remetenteEmail: row.remetenteEmail ?? '',
      remetenteNome: row.remetenteNome ?? '',
      replyTo: row.replyTo ?? '',
      smtpHost: row.smtpHost ?? '',
      smtpPort: row.smtpPort,
      seguranca: normalizeSeguranca(row.seguranca),
      usarAutenticacao: row.usarAutenticacao,
      usuario: row.usuario ?? '',
      senhaDefinida: Boolean(row.senhaEnc),
      assuntoEquipe: row.assuntoEquipe ?? '',
      textoIntroEquipe: row.textoIntroEquipe ?? '',
      origem: row.ativo && row.smtpHost && row.remetenteEmail ? 'tela' : 'nenhuma',
    };
  }

  private toAudit(row: {
    ativo: boolean;
    remetenteEmail: string | null;
    remetenteNome: string | null;
    replyTo: string | null;
    smtpHost: string | null;
    smtpPort: number;
    seguranca: string;
    usarAutenticacao: boolean;
    usuario: string | null;
    senhaEnc: string | null;
    assuntoEquipe: string | null;
    textoIntroEquipe: string | null;
  }) {
    return {
      ativo: row.ativo,
      remetenteEmail: row.remetenteEmail,
      remetenteNome: row.remetenteNome,
      replyTo: row.replyTo,
      smtpHost: row.smtpHost,
      smtpPort: row.smtpPort,
      seguranca: row.seguranca,
      usarAutenticacao: row.usarAutenticacao,
      usuario: row.usuario,
      senhaDefinida: Boolean(row.senhaEnc),
      assuntoEquipe: row.assuntoEquipe,
      textoIntroEquipe: row.textoIntroEquipe,
    };
  }
}

function normalizeSeguranca(value?: string | null): 'NENHUMA' | 'SSL' | 'TLS' {
  const upper = value?.trim().toUpperCase();
  if (upper === 'NENHUMA' || upper === 'SSL' || upper === 'TLS') return upper;
  return 'TLS';
}

function emptyToNull(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
