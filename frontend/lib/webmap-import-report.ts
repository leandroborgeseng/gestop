import { WebmapImportResult, WebmapRejectedFeature, WebmapSkippedUnit } from '@/lib/types';

function csvEscape(value: string | number | null | undefined) {
  const text = value == null ? '' : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  const content = [headers.join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadWebmapSkippedCsv(units: WebmapSkippedUnit[]) {
  downloadCsv('sigma-webmap-unidades-ignoradas.csv', [
    'codigo_patrimonial',
    'nome',
    'secretaria_sigla',
    'unidade_municipal',
    'camada',
    'grupo',
    'endereco',
    'bairro',
    'latitude',
    'longitude',
    'motivo',
    'sugestao_correcao',
  ], units.map((unit) => [
    unit.codigoPatrimonial,
    unit.nome,
    unit.secretariaSigla,
    unit.unidadeMunicipal ?? '',
    unit.layerFile,
    unit.layerGroup,
    unit.endereco,
    unit.bairro ?? '',
    unit.latitude,
    unit.longitude,
    unit.reason,
    unit.sugestao,
  ]));
}

export function downloadWebmapRejectedCsv(features: WebmapRejectedFeature[]) {
  downloadCsv('sigma-webmap-features-rejeitadas.csv', [
    'camada',
    'grupo',
    'fid',
    'motivo',
    'nome_parcial',
    'unidade_municipal',
    'cadastro_imobiliario',
    'sugestao_correcao',
  ], features.map((feature) => [
    feature.layerFile,
    feature.layerGroup,
    feature.fid,
    feature.reason,
    feature.nomeParcial ?? '',
    feature.unidadeMunicipal ?? '',
    feature.cadastroImobiliario ?? '',
    feature.sugestao,
  ]));
}

export function downloadWebmapSkippedGeoJson(units: WebmapSkippedUnit[]) {
  const geojson = {
    type: 'FeatureCollection',
    features: units.map((unit) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [unit.longitude, unit.latitude] },
      properties: {
        codigoPatrimonial: unit.codigoPatrimonial,
        nome: unit.nome,
        secretariaSigla: unit.secretariaSigla,
        layerFile: unit.layerFile,
        reason: unit.reason,
        sugestao: unit.sugestao,
      },
    })),
  };
  const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'sigma-webmap-unidades-ignoradas.geojson';
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadWebmapImportReportCsv(result: WebmapImportResult) {
  downloadWebmapSkippedCsv(result.skippedUnits);
  if (result.rejectedFeatures.length > 0) {
    setTimeout(() => downloadWebmapRejectedCsv(result.rejectedFeatures), 300);
  }
}

export function summarizeSkippedBySecretaria(units: WebmapSkippedUnit[]) {
  const counts = new Map<string, number>();
  for (const unit of units) {
    counts.set(unit.secretariaSigla, (counts.get(unit.secretariaSigla) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
}
