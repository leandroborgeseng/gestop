export type HeatLegend = {
  baixaAte: number;
  mediaDe: number;
  mediaAte: number;
  altaAcima: number;
};

const CELL = 0.008;

function cellKey(lat: number, lng: number) {
  return `${Math.floor(lat / CELL)}:${Math.floor(lng / CELL)}`;
}

export function heatCellCounts(points: Array<{ lat: number; lng: number }>) {
  const counts = new Map<string, number>();
  for (const point of points) {
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) continue;
    const key = cellKey(point.lat, point.lng);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function heatCountAt(counts: Map<string, number>, lat: number, lng: number) {
  return counts.get(cellKey(lat, lng)) ?? 0;
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
  pixels: Array<{ x: number; y: number; count: number }>,
  legend: HeatLegend,
) {
  ctx.clearRect(0, 0, width, height);
  const seen = new Set<string>();
  for (const pixel of pixels) {
    if (!Number.isFinite(pixel.x) || !Number.isFinite(pixel.y) || pixel.count <= 0) continue;
    if (pixel.x < -40 || pixel.y < -40 || pixel.x > width + 40 || pixel.y > height + 40) continue;
    const bucket = `${Math.round(pixel.x / 8)}:${Math.round(pixel.y / 8)}:${pixel.count}`;
    if (seen.has(bucket)) continue;
    seen.add(bucket);
    const faixa = pixel.count <= legend.baixaAte ? 0 : pixel.count <= legend.mediaAte ? 1 : 2;
    ctx.fillStyle = faixa === 0 ? '#fde68a' : faixa === 1 ? '#f97316' : '#9a3412';
    ctx.globalAlpha = faixa === 0 ? 0.55 : faixa === 1 ? 0.7 : 0.82;
    ctx.beginPath();
    ctx.arc(pixel.x, pixel.y, faixa === 2 ? 22 : 16, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
