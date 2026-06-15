'use client';

import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Shield } from 'lucide-react';
import {
  WebmapImportResult,
  WebmapImportSelection,
  WebmapUnitChange,
  WebmapUnitChangeAction,
} from '@/lib/types';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const ACTION_LABEL: Record<WebmapUnitChangeAction, string> = {
  CREATE: 'Criar',
  UPDATE: 'Atualizar',
  SKIP: 'Ignorar',
  DEACTIVATE: 'Desativar',
  UNCHANGED: 'Sem alteração',
};

const ACTION_VARIANT: Record<WebmapUnitChangeAction, 'success' | 'warning' | 'muted' | 'danger' | 'info'> = {
  CREATE: 'success',
  UPDATE: 'info',
  SKIP: 'warning',
  DEACTIVATE: 'danger',
  UNCHANGED: 'muted',
};

const SKIP_REASON_LABEL: Record<string, string> = {
  MANUAL_LOCK: 'Bloqueado por edição manual',
  NOT_SELECTED: 'Não selecionado',
  UNCHANGED: 'Sem mudança',
};

type FilterAction = 'ALL' | WebmapUnitChangeAction;

function buildDefaultSelections(changes: WebmapUnitChange[]): WebmapImportSelection[] {
  return changes
    .filter((item) => item.action === 'CREATE' || item.action === 'UPDATE' || item.action === 'DEACTIVATE')
    .map((item) => ({
      codigoPatrimonial: item.codigoPatrimonial,
      apply: item.action !== 'DEACTIVATE' ? true : true,
      fields: item.changes?.filter((change) => change.willApply).map((change) => change.field),
    }));
}

export function WebmapImportPreview({
  result,
  onApply,
  applying,
}: {
  result: WebmapImportResult;
  onApply: (payload: { selections: WebmapImportSelection[]; applyDeactivations: boolean }) => Promise<void>;
  applying: boolean;
}) {
  const unitChanges = result.diff?.unitChanges ?? [];
  const [filter, setFilter] = useState<FilterAction>('ALL');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selections, setSelections] = useState<WebmapImportSelection[]>(() => buildDefaultSelections(unitChanges));
  const [applyDeactivations, setApplyDeactivations] = useState(true);

  const counts = useMemo(() => {
    const tally: Record<WebmapUnitChangeAction, number> = {
      CREATE: 0,
      UPDATE: 0,
      SKIP: 0,
      DEACTIVATE: 0,
      UNCHANGED: 0,
    };
    for (const item of unitChanges) tally[item.action] += 1;
    return tally;
  }, [unitChanges]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return unitChanges.filter((item) => {
      if (filter !== 'ALL' && item.action !== filter) return false;
      if (!query) return true;
      return (
        item.codigoPatrimonial.toLowerCase().includes(query) ||
        item.nome.toLowerCase().includes(query)
      );
    });
  }, [filter, search, unitChanges]);

  function toggleExpanded(codigo: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(codigo)) next.delete(codigo);
      else next.add(codigo);
      return next;
    });
  }

  function isUnitSelected(codigo: string) {
    const selection = selections.find((item) => item.codigoPatrimonial === codigo);
    return selection?.apply !== false;
  }

  function toggleUnit(codigo: string, checked: boolean) {
    setSelections((current) => {
      const existing = current.find((item) => item.codigoPatrimonial === codigo);
      if (existing) {
        return current.map((item) =>
          item.codigoPatrimonial === codigo ? { ...item, apply: checked } : item,
        );
      }
      return [...current, { codigoPatrimonial: codigo, apply: checked }];
    });
  }

  function toggleField(codigo: string, field: string, checked: boolean) {
    setSelections((current) => {
      const unit = unitChanges.find((item) => item.codigoPatrimonial === codigo);
      const existing = current.find((item) => item.codigoPatrimonial === codigo);
      const allFields = unit?.changes?.map((change) => change.field) ?? [];
      const baseFields = existing?.fields?.length ? [...existing.fields] : allFields.filter(Boolean);

      const nextFields = checked
        ? [...new Set([...baseFields, field])]
        : baseFields.filter((item) => item !== field);

      if (existing) {
        return current.map((item) =>
          item.codigoPatrimonial === codigo
            ? { ...item, apply: true, fields: nextFields }
            : item,
        );
      }

      return [...current, { codigoPatrimonial: codigo, apply: true, fields: nextFields }];
    });
  }

  function isFieldSelected(codigo: string, field: string, defaultWillApply: boolean) {
    const selection = selections.find((item) => item.codigoPatrimonial === codigo);
    if (!selection) return defaultWillApply;
    if (selection.apply === false) return false;
    if (!selection.fields?.length) return defaultWillApply;
    return selection.fields.includes(field);
  }

  const selectedApplyCount = selections.filter((item) => item.apply !== false).length;
  const hasActionable = counts.CREATE + counts.UPDATE + counts.DEACTIVATE > 0;

  return (
    <Card elevation={2}>
      <CardHeader>
        <CardTitle className="md-title-lg">Revisar alterações antes de aplicar</CardTitle>
        <CardDescription>
          Compare o que o QGIS traz com a base de produção. Campos editados manualmente aparecem bloqueados.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {(['ALL', 'CREATE', 'UPDATE', 'UNCHANGED', 'SKIP', 'DEACTIVATE'] as FilterAction[]).map((action) => (
            <Button
              key={action}
              size="sm"
              variant={filter === action ? 'filled' : 'tonal'}
              onClick={() => setFilter(action)}
            >
              {action === 'ALL' ? 'Todos' : ACTION_LABEL[action]} (
              {action === 'ALL' ? unitChanges.length : counts[action as WebmapUnitChangeAction]})
            </Button>
          ))}
        </div>

        <Field label="Buscar por código ou nome">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="PMF-..., escola, UBS..."
          />
        </Field>

        {(result.diff?.blockedCount ?? 0) > 0 ? (
          <Alert variant="warning">
            {result.diff?.blockedCount} registro(s) com campos bloqueados por edição manual ou desmarcação no preview.
          </Alert>
        ) : null}

        <div className="overflow-x-auto rounded-[var(--md-shape-md)] border border-[var(--md-outline-variant)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHeader className="w-10"> </TableHeader>
                <TableHeader>Aplicar</TableHeader>
                <TableHeader>Código</TableHeader>
                <TableHeader>Nome</TableHeader>
                <TableHeader>Ação</TableHeader>
                <TableHeader>Detalhe</TableHeader>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => {
                const isExpandable = Boolean(item.changes?.length);
                const isOpen = expanded.has(item.codigoPatrimonial);
                const canToggle = item.action === 'CREATE' || item.action === 'UPDATE' || item.action === 'DEACTIVATE';

                return (
                  <Fragment key={item.codigoPatrimonial}>
                    <TableRow>
                      <TableCell>
                        {isExpandable ? (
                          <button
                            type="button"
                            className="text-[var(--md-on-surface-variant)]"
                            onClick={() => toggleExpanded(item.codigoPatrimonial)}
                            aria-label={isOpen ? 'Recolher' : 'Expandir'}
                          >
                            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {canToggle ? (
                          <input
                            type="checkbox"
                            checked={item.action === 'DEACTIVATE' ? applyDeactivations && isUnitSelected(item.codigoPatrimonial) : isUnitSelected(item.codigoPatrimonial)}
                            onChange={(event) => {
                              if (item.action === 'DEACTIVATE') {
                                setApplyDeactivations(event.target.checked);
                                toggleUnit(item.codigoPatrimonial, event.target.checked);
                              } else {
                                toggleUnit(item.codigoPatrimonial, event.target.checked);
                              }
                            }}
                          />
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{item.codigoPatrimonial}</TableCell>
                      <TableCell>{item.nome}</TableCell>
                      <TableCell>
                        <Badge variant={ACTION_VARIANT[item.action]}>{ACTION_LABEL[item.action]}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-[var(--md-on-surface-variant)]">
                        {item.skipReason ?? (item.changes?.filter((change) => change.willApply).length
                          ? `${item.changes.filter((change) => change.willApply).length} campo(s)`
                          : '—')}
                      </TableCell>
                    </TableRow>
                    {isOpen && item.changes?.length ? (
                      <TableRow key={`${item.codigoPatrimonial}-detail`}>
                        <TableCell colSpan={6} className="bg-[var(--md-surface-container-low)]">
                          <div className="space-y-2 py-2">
                            {item.changes.map((change) => (
                              <div
                                key={`${item.codigoPatrimonial}-${change.field}`}
                                className="grid gap-2 rounded-[var(--md-shape-sm)] border border-[var(--md-outline-variant)] bg-[var(--md-surface)] p-3 md:grid-cols-[1fr_1fr_1fr_auto]"
                              >
                                <div>
                                  <p className="md-label-md">{change.label}</p>
                                  {change.skipReason ? (
                                    <p className="md-label-md mt-1 flex items-center gap-1 text-[var(--md-on-surface-variant)]">
                                      {change.skipReason === 'MANUAL_LOCK' ? <Shield className="h-3 w-3" /> : null}
                                      {SKIP_REASON_LABEL[change.skipReason] ?? change.skipReason}
                                    </p>
                                  ) : null}
                                </div>
                                <div className="text-sm">
                                  <span className="md-label-md text-[var(--md-on-surface-variant)]">Produção: </span>
                                  {change.before ?? '—'}
                                </div>
                                <div className="text-sm">
                                  <span className="md-label-md text-[var(--md-on-surface-variant)]">QGIS: </span>
                                  {change.after ?? '—'}
                                </div>
                                <div className="flex items-center justify-end">
                                  {item.action === 'UPDATE' && change.before !== change.after ? (
                                    <label className="flex items-center gap-2 text-xs">
                                      <input
                                        type="checkbox"
                                        checked={isFieldSelected(
                                          item.codigoPatrimonial,
                                          change.field,
                                          change.willApply,
                                        )}
                                        disabled={change.skipReason === 'MANUAL_LOCK' || change.skipReason === 'UNCHANGED'}
                                        onChange={(event) =>
                                          toggleField(item.codigoPatrimonial, change.field, event.target.checked)
                                        }
                                      />
                                      Aplicar
                                    </label>
                                  ) : change.willApply ? (
                                    <Badge variant="success">Aplicar</Badge>
                                  ) : (
                                    <Badge variant="muted">Manter</Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {filtered.length === 0 ? (
          <p className="text-center text-sm text-[var(--md-on-surface-variant)]">Nenhum registro neste filtro.</p>
        ) : null}

        {hasActionable ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--md-outline-variant)] pt-4">
            <p className="text-sm text-[var(--md-on-surface-variant)]">
              {selectedApplyCount} unidade(s) marcadas para aplicar
              {counts.DEACTIVATE > 0 ? ` · Desativações: ${applyDeactivations ? 'sim' : 'não'}` : ''}
            </p>
            <Button
              variant="filled"
              disabled={applying}
              onClick={() =>
                void onApply({
                  selections,
                  applyDeactivations,
                })
              }
            >
              {applying ? 'Aplicando...' : 'Aplicar selecionados na produção'}
            </Button>
          </div>
        ) : (
          <Alert variant="success">Nenhuma alteração pendente para aplicar nesta simulação.</Alert>
        )}
      </CardContent>
    </Card>
  );
}
