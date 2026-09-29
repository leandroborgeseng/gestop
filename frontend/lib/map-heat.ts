export type HeatLegend = {
  baixaAte: number;
  mediaDe: number;
  mediaAte: number;
  altaAcima: number;
};

const CELL = 0.008;

export function heatCellCounts(points: Array<{ lat: number; lng: number }>) {
  const counts = new Map<string, number>();
  for (const point of points) {
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) continue;
    const key = `${Math.floor(point.lat / CELL)}:${Math.floor(point.lng / CELL)}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function heatLegend(points: Array<{ lat: number; lng: number }>): HeatLegend | null {
  const counts = [...heatCellCounts(points).values()];
  if (counts.length === 0) return null;
  const max = Math.max(...counts);
  if (max <= 1) {
    return { baixaAte: 1, mediaDe: 1, mediaAte: 1, altaAcima: 1 };
  }
  const baixaAte = Math.max(1, Math.floor(max / 3));
  const mediaAte = Math.max(baixaAte + 1, Math.ceil((max * 2) / 3));
  return {
    baixaAte,
    mediaDe: baixaAte + 1,
    mediaAte,
    altaAcima: mediaAte,
  };
}

export function paintHeat(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pixels: Array<{ x: number; y: number }>,
  _legend: HeatLegend,
) {
  ctx.clearRect(0, 0, width, height);
  const cell = 42;
  const cols = Math.max(1, Math.ceil(width / cell));
  const rows = Math.max(1, Math.ceil(height / cell));
  const grid = new Float32Array(cols * rows);
  for (const pixel of pixels) {
    const c = Math.floor(pixel.x / cell);
    const r = Math.floor(pixel.y / cell);
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        const cc = c + dc;
        const rr = r + dr;
        if (cc < 0 || rr < 0 || cc >= cols || rr >= rows) continue;
        const weight = dr === 0 && dc === 0 ? 1 : 0.4;
        grid[rr * cols + cc] += weight;
      }
    }
  }
  let max = 0;
  for (const value of grid) if (value > max) max = value;
  if (max <= 0) return;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const value = grid[r * cols + c];
      if (value <= 0) continue;
      const t = value / max;
      const intensity = t < 0.34 ? 0.35 : t < 0.67 ? 0.65 : 1;
      ctx.fillStyle = intensity < 0.5 ? '#fde68a' : intensity < 0.8 ? '#f97316' : '#9a3412';
      ctx.globalAlpha = 0.28 + 0.5 * intensity;
      ctx.beginPath();
      ctx.arc(c * cell + cell / 2, r * cell + cell / 2, cell * 0.78, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}
