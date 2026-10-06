import { escapeHtml } from '@/lib/security';
import type { ChamadoMapPoint } from '@/lib/types';

function formatDateBr(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR');
}

export function buildPopupHtml(point: ChamadoMapPoint, actionLabel: string) {
  const programado = point.programado ? formatDateBr(point.previstaExecucaoEm) : null;
  const prazo = point.prazoEm ? formatDateBr(point.prazoEm) : null;
  return `
    <div style="min-width:240px;font-family:system-ui,sans-serif;">
      <strong style="display:block;font-size:13px;color:#0066cc;">${escapeHtml(point.codigo)}</strong>
      <span style="display:block;margin-top:4px;font-size:13px;color:#0f1b2d;font-weight:600;">${escapeHtml(point.titulo)}</span>
      <span style="display:block;margin-top:4px;font-size:12px;color:#647389;">${escapeHtml(point.unidadeNome)}</span>
      ${programado ? `<span style="display:block;margin-top:6px;font-size:12px;color:#647389;">Data programada: <strong>${escapeHtml(programado)}</strong></span>` : ''}
      ${point.equipeNome ? `<span style="display:block;margin-top:4px;font-size:12px;color:#647389;">Equipe: <strong>${escapeHtml(point.equipeNome)}</strong></span>` : ''}
      ${point.responsavelNome ? `<span style="display:block;margin-top:4px;font-size:12px;color:#647389;">Responsável: <strong>${escapeHtml(point.responsavelNome)}</strong></span>` : ''}
      <span style="display:block;margin-top:4px;font-size:12px;color:#647389;">Prioridade: <strong>${escapeHtml(point.prioridade)}</strong></span>
      ${prazo ? `<span style="display:block;margin-top:4px;font-size:12px;color:#647389;">Prazo: <strong>${escapeHtml(prazo)}</strong></span>` : ''}
      <button type="button" data-map-popup-id="${escapeHtml(point.id)}" data-chamado-id="${escapeHtml(point.id)}" style="display:inline-block;margin-top:10px;font-size:12px;font-weight:700;color:#0066cc;background:none;border:0;padding:0;cursor:pointer;">
        ${escapeHtml(actionLabel)}
      </button>
    </div>
  `;
}
