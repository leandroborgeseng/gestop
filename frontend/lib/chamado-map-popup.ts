import { escapeHtml } from '@/lib/security';
import type { ChamadoMapPoint } from '@/lib/types';

function formatDateBr(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR');
}

export const ROTULO_SEM_RESPONSAVEL = 'Sem responsável';

export function buildPopupHtml(point: ChamadoMapPoint, actionLabel: string) {
  const programado = point.programado ? formatDateBr(point.previstaExecucaoEm) : null;
  const prazo = point.prazoEm ? formatDateBr(point.prazoEm) : null;
  const resumo = point.resumoChamado?.trim() || '—';
  const responsavel = point.responsavelNome?.trim() || ROTULO_SEM_RESPONSAVEL;
  return `
    <div style="min-width:240px;font-family:system-ui,sans-serif;">
      <strong style="display:block;font-size:13px;color:#0066cc;">${escapeHtml(point.codigo)}</strong>
      <span style="display:block;margin-top:4px;font-size:13px;color:#0f1b2d;font-weight:600;">Tarefa: ${escapeHtml(point.titulo)}</span>
      <span style="display:block;margin-top:4px;font-size:12px;color:#0f1b2d;">Chamado: ${escapeHtml(resumo)}</span>
      <span style="display:block;margin-top:4px;font-size:12px;color:#647389;">${escapeHtml(point.unidadeNome)}</span>
      ${programado ? `<span style="display:block;margin-top:6px;font-size:12px;color:#647389;">Data programada: <strong>${escapeHtml(programado)}</strong></span>` : ''}
      ${point.equipeNome ? `<span style="display:block;margin-top:4px;font-size:12px;color:#647389;">Equipe: <strong>${escapeHtml(point.equipeNome)}</strong></span>` : ''}
      <span style="display:block;margin-top:4px;font-size:12px;color:#647389;">Responsável: <strong>${escapeHtml(responsavel)}</strong></span>
      <span style="display:block;margin-top:4px;font-size:12px;color:#647389;">Prioridade: <strong>${escapeHtml(point.prioridade)}</strong></span>
      ${prazo ? `<span style="display:block;margin-top:4px;font-size:12px;color:#647389;">Prazo: <strong>${escapeHtml(prazo)}</strong></span>` : ''}
      <button type="button" data-map-popup-id="${escapeHtml(point.id)}" data-chamado-id="${escapeHtml(point.id)}" style="display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;margin-top:10px;min-width:24px;min-height:32px;padding:6px 10px;font-size:12px;font-weight:700;color:#0066cc;background:none;border:0;cursor:pointer;">
        ${escapeHtml(actionLabel)}
      </button>
    </div>
  `;
}
