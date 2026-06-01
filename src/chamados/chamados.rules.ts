export function buildChamadoCode(sequence: number) {
  return `CH-${new Date().getFullYear()}-${String(sequence).padStart(6, '0')}`;
}
