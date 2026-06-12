/** Limite padrão de 25 MB — cobre fotos comuns de celular (JPEG/HEIC). */
export const DEFAULT_MAX_EVIDENCE_BYTES = 25 * 1024 * 1024;

export function resolveMaxEvidenceBytes() {
  const configured = Number(process.env.STORAGE_MAX_FILE_BYTES);
  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }
  return DEFAULT_MAX_EVIDENCE_BYTES;
}

export function formatEvidenceLimitMb(bytes: number) {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}
