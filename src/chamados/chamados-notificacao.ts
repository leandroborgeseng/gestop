import { EmailService } from '../email/email.service';

type ChamadoNotificacaoInput = {
  codigo: string;
  tipo: string;
  descricao: string;
  endereco: string;
  prioridade: string;
  status: string;
  secretaria: string;
  equipe: string;
  responsavel: string;
  prazoSla: string;
  link: string;
  fotos: string[];
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildChamadoAtribuicaoEmailHtml(input: ChamadoNotificacaoInput) {
  const fotosHtml =
    input.fotos.length > 0
      ? `<div style="margin-top:16px"><p style="font-weight:600;margin:0 0 8px">Fotos da abertura</p>${input.fotos
          .map(
            (url) =>
              `<img src="${escapeHtml(url)}" alt="Foto do chamado" style="max-width:100%;height:auto;border-radius:8px;margin-bottom:8px;display:block" />`,
          )
          .join('')}</div>`
      : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<body style="font-family:Arial,sans-serif;color:#1a1a1a;line-height:1.5;margin:0;padding:24px;background:#f5f7fa">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #ddd;border-radius:12px;padding:24px">
    <h1 style="font-size:18px;color:#0066cc;margin:0 0 16px">Chamado atribuído à equipe</h1>
    <p style="margin:0 0 8px"><strong>Chamado:</strong> ${escapeHtml(input.codigo)}</p>
    <p style="margin:0 0 8px"><strong>Tipo:</strong> ${escapeHtml(input.tipo)}</p>
    <p style="margin:0 0 8px"><strong>Descrição:</strong> ${escapeHtml(input.descricao)}</p>
    <p style="margin:0 0 8px"><strong>Endereço:</strong> ${escapeHtml(input.endereco)}</p>
    <p style="margin:0 0 8px"><strong>Prioridade:</strong> ${escapeHtml(input.prioridade)}</p>
    <p style="margin:0 0 8px"><strong>Status:</strong> ${escapeHtml(input.status)}</p>
    <p style="margin:0 0 8px"><strong>Secretaria:</strong> ${escapeHtml(input.secretaria)}</p>
    <p style="margin:0 0 8px"><strong>Equipe:</strong> ${escapeHtml(input.equipe)}</p>
    <p style="margin:0 0 8px"><strong>Responsável:</strong> ${escapeHtml(input.responsavel)}</p>
    <p style="margin:0 0 16px"><strong>Prazo SLA:</strong> ${escapeHtml(input.prazoSla)}</p>
    <p style="margin:0 0 16px"><a href="${escapeHtml(input.link)}" style="display:inline-block;background:#0066cc;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600">Visualizar chamado</a></p>
    ${fotosHtml}
  </div>
</body>
</html>`;
}

export async function sendChamadoEquipeNotificacao(
  emailService: EmailService,
  input: {
    to: string[];
    cc?: string[];
    chamado: ChamadoNotificacaoInput;
    subject?: string;
    intro?: string;
  },
) {
  const recipients = [...new Set(input.to.map((item) => item.trim().toLowerCase()).filter(Boolean))];
  if (recipients.length === 0) {
    return { delivered: false, driver: 'smtp' as const, detail: 'Nenhum destinatário válido' };
  }

  const cc = [...new Set((input.cc ?? []).map((item) => item.trim().toLowerCase()).filter(Boolean))];

  const html = buildChamadoAtribuicaoEmailHtml(input.chamado);
  const intro = input.intro?.trim();
  const text = [
    input.subject?.trim() || 'Chamado atribuído à equipe',
    intro ? '' : null,
    intro || null,
    '',
    `Chamado: ${input.chamado.codigo}`,
    `Tipo: ${input.chamado.tipo}`,
    `Descrição: ${input.chamado.descricao}`,
    `Endereço: ${input.chamado.endereco}`,
    `Prioridade: ${input.chamado.prioridade}`,
    `Status: ${input.chamado.status}`,
    `Secretaria: ${input.chamado.secretaria}`,
    `Equipe: ${input.chamado.equipe}`,
    `Responsável: ${input.chamado.responsavel}`,
    `Prazo SLA: ${input.chamado.prazoSla}`,
    `Link: ${input.chamado.link}`,
  ]
    .filter((line) => line !== null)
    .join('\n');

  const htmlComIntro = intro
    ? html.replace(
        '<h1 style="font-size:18px;color:#0066cc;margin:0 0 16px">Chamado atribuído à equipe</h1>',
        `<h1 style="font-size:18px;color:#0066cc;margin:0 0 16px">Chamado atribuído à equipe</h1><p style="margin:0 0 16px">${escapeHtml(intro)}</p>`,
      )
    : html;

  return emailService.send({
    to: recipients,
    cc: cc.length ? cc : undefined,
    subject: input.subject?.trim() || 'Chamado atribuído à equipe',
    text,
    html: htmlComIntro,
    tags: ['chamado', 'notificacao-equipe'],
  });
}
