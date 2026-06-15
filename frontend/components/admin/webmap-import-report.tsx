'use client';

import { FileDown } from 'lucide-react';
import { WebmapImportResult, WebmapRejectedFeature, WebmapSkippedUnit } from '@/lib/types';
import {
  downloadWebmapImportReportCsv,
  downloadWebmapRejectedCsv,
  downloadWebmapSkippedCsv,
  downloadWebmapSkippedGeoJson,
  summarizeSkippedBySecretaria,
} from '@/lib/webmap-import-report';
import { WebmapSkippedMap } from '@/components/admin/webmap-skipped-map';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormSection } from '@/components/ui/form-section';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const SKIP_REASON_LABEL: Record<WebmapSkippedUnit['reason'], string> = {
  SECRETARIA_NAO_CADASTRADA: 'Secretaria não cadastrada no SIGMA',
  SECRETARIA_NAO_RESOLVIDA: 'Campo unidade_municipal ausente ou inválido',
};

const REJECT_REASON_LABEL: Record<WebmapRejectedFeature['reason'], string> = {
  SEM_COORDENADAS: 'Sem coordenadas',
  SEM_NOME: 'Sem nome identificável',
  FORA_MUNICIPIO: 'Fora dos limites de Franca/SP',
  CADASTRO_INVALIDO: 'Cadastro imobiliário inválido',
};

export function WebmapImportReport({
  result,
  title,
}: {
  result: WebmapImportResult;
  title: string;
}) {
  const skippedSummary = summarizeSkippedBySecretaria(result.skippedUnits);

  return (
    <div className="space-y-6">
      <FormSection title={title}>
        <ul className="md-body-md space-y-1 text-[var(--md-on-surface-variant)]">
          <li>Features lidas: {result.featuresRead}</li>
          <li>Unidades únicas: {result.uniqueUnits}</li>
          <li>
            Criadas: {result.created} · Atualizadas: {result.updated} · Ignoradas: {result.skipped}
            {typeof result.deactivated === 'number' ? ` · Desativadas: ${result.deactivated}` : ''}
          </li>
          <li>Rejeitadas na leitura: {result.rejectedFeatures.length}</li>
          <li>
            Camadas: {result.layersProcessed} ok · {result.layersFailed} com erro
            {result.layersDiscovered ? ` · ${result.layersDiscovered} descobertas` : ''}
          </li>
          {result.autoDiscoveredLayers?.length ? (
            <li>Auto-descobertas: {result.autoDiscoveredLayers.length} camadas novas</li>
          ) : null}
          <li>Total ativas no banco: {result.totalUnidadesInDb}</li>
          <li>Secretarias cadastradas: {result.secretariasCadastradas.join(', ')}</li>
          {result.durationMs ? <li>Duração: {(result.durationMs / 1000).toFixed(1)}s</li> : null}
          {result.diff ? (
            <li>
              Diff: +{result.diff.createdCodigos.length} novas · {result.diff.updatedCodigos.length} alteradas ·{' '}
              {result.diff.deactivatedCodigos.length} desativadas
              {typeof result.diff.unchangedCount === 'number' ? ` · ${result.diff.unchangedCount} sem mudança` : ''}
              {typeof result.diff.blockedCount === 'number' && result.diff.blockedCount > 0
                ? ` · ${result.diff.blockedCount} bloqueadas`
                : ''}
            </li>
          ) : null}
          <li>
            GitHub: {result.github.commitSha.slice(0, 7)} — {result.github.commitMessage}
          </li>
        </ul>
      </FormSection>

      {result.skipped > 0 ? (
        <Card elevation={1}>
          <CardHeader>
            <CardTitle className="md-title-md">Unidades ignoradas ({result.skipped})</CardTitle>
            <CardDescription>
              Entidades lidas do QGIS que não entraram no SIGMA. Envie CSV ou GeoJSON para a equipe corrigir.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="warning">
              Por secretaria: {skippedSummary.map(([sigla, count]) => `${sigla}: ${count}`).join(' · ')}
            </Alert>

            <WebmapSkippedMap units={result.skippedUnits} />

            <div className="flex flex-wrap gap-3">
              <Button variant="tonal" onClick={() => downloadWebmapSkippedCsv(result.skippedUnits)}>
                <FileDown className="h-4 w-4" />
                CSV para QGIS
              </Button>
              <Button variant="tonal" onClick={() => downloadWebmapSkippedGeoJson(result.skippedUnits)}>
                <FileDown className="h-4 w-4" />
                GeoJSON
              </Button>
              <Button variant="ghost" onClick={() => downloadWebmapImportReportCsv(result)}>
                <FileDown className="h-4 w-4" />
                Relatório completo
              </Button>
            </div>

            <div className="overflow-x-auto rounded-[var(--md-shape-md)] border border-[var(--md-outline-variant)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Secretaria</TableHead>
                    <TableHead>Camada QGIS</TableHead>
                    <TableHead>Endereço</TableHead>
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.skippedUnits.map((unit) => (
                    <TableRow key={unit.codigoPatrimonial}>
                      <TableCell className="font-mono text-xs">{unit.codigoPatrimonial}</TableCell>
                      <TableCell>{unit.nome}</TableCell>
                      <TableCell>{unit.secretariaSigla}</TableCell>
                      <TableCell className="max-w-[12rem] truncate text-xs">
                        <span title={unit.layerFile}>{unit.layerFile}</span>
                      </TableCell>
                      <TableCell className="max-w-[14rem] truncate">
                        <span title={unit.endereco}>{unit.endereco}</span>
                      </TableCell>
                      <TableCell className="text-xs text-[var(--md-on-surface-variant)]">
                        {SKIP_REASON_LABEL[unit.reason]}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {result.deactivatedUnits && result.deactivatedUnits.length > 0 ? (
        <Card elevation={1}>
          <CardHeader>
            <CardTitle className="md-title-md">Unidades desativadas ({result.deactivatedUnits.length})</CardTitle>
            <CardDescription>Presentes no SIGMA mas ausentes na última sync do webmap.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="md-body-md max-h-48 space-y-1 overflow-y-auto text-[var(--md-on-surface-variant)]">
              {result.deactivatedUnits.map((unit) => (
                <li key={unit.codigoPatrimonial}>
                  {unit.codigoPatrimonial} — {unit.nome}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {result.rejectedFeatures.length > 0 ? (
        <Card elevation={1}>
          <CardHeader>
            <CardTitle className="md-title-md">
              Features rejeitadas na leitura ({result.rejectedFeatures.length})
            </CardTitle>
            <CardDescription>
              Registros descartados por coordenadas, nome, cadastro ou localização fora de Franca.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="tonal" onClick={() => downloadWebmapRejectedCsv(result.rejectedFeatures)}>
              <FileDown className="h-4 w-4" />
              CSV de features rejeitadas
            </Button>

            <div className="overflow-x-auto rounded-[var(--md-shape-md)] border border-[var(--md-outline-variant)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>FID</TableHead>
                    <TableHead>Camada</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Nome parcial</TableHead>
                    <TableHead>Sugestão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.rejectedFeatures.map((feature) => (
                    <TableRow key={`${feature.layerFile}-${feature.fid}-${feature.reason}`}>
                      <TableCell>{feature.fid}</TableCell>
                      <TableCell className="max-w-[12rem] truncate text-xs">
                        <span title={feature.layerFile}>{feature.layerFile}</span>
                      </TableCell>
                      <TableCell>{REJECT_REASON_LABEL[feature.reason]}</TableCell>
                      <TableCell>{feature.nomeParcial ?? '—'}</TableCell>
                      <TableCell className="text-xs text-[var(--md-on-surface-variant)]">{feature.sugestao}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
