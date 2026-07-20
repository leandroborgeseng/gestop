'use client';

import { useState } from 'react';
import { BarChart3, List } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import type { DashboardRankingItem } from '@/lib/types';

export function DashboardAnalysisCard({
  title,
  hint,
  items,
  emptyLabel = 'Sem informação',
}: {
  title: string;
  hint?: string;
  items: DashboardRankingItem[];
  emptyLabel?: string;
}) {
  const [mode, setMode] = useState<'grafico' | 'lista'>('grafico');
  const chartItems = items.slice(0, 8);
  const max = Math.max(...chartItems.map((item) => item.total), 1);

  return (
    <Card elevation={1} className="min-h-0 overflow-hidden">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle className="text-[var(--ink)]">{title}</CardTitle>
          {hint ? <p className="mt-1 text-[12px] text-[var(--ink-3)]">{hint}</p> : null}
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            type="button"
            size="sm"
            variant={mode === 'grafico' ? 'filled' : 'outlined'}
            className="h-8 gap-1 px-2"
            onClick={() => setMode('grafico')}
            aria-label="Visualização gráfica"
          >
            <BarChart3 className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === 'lista' ? 'filled' : 'outlined'}
            className="h-8 gap-1 px-2"
            onClick={() => setMode('lista')}
            aria-label="Visualização em lista"
          >
            <List className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {items.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-[var(--ink-3)]">{emptyLabel}</p>
        ) : mode === 'grafico' ? (
          <div className="space-y-2">
            {chartItems.map((item) => (
              <div key={item.chave} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2 text-[12px]">
                  <span className="min-w-0 truncate font-medium text-[var(--ink)]">
                    {item.label}
                    {item.detalhe ? (
                      <span className="font-normal text-[var(--ink-3)]"> · {item.detalhe}</span>
                    ) : null}
                  </span>
                  <span className="mono shrink-0 font-semibold text-[var(--ink)]">{item.total}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
                  <div
                    className="h-full rounded-full bg-[var(--brand)]"
                    style={{ width: `${Math.max((item.total / max) * 100, 4)}%` }}
                  />
                </div>
              </div>
            ))}
            {items.length > chartItems.length ? (
              <p className="pt-1 text-[11px] text-[var(--ink-3)]">
                Top {chartItems.length} no gráfico · veja todos na lista ({items.length})
              </p>
            ) : null}
          </div>
        ) : (
          <div className={cn('max-h-[280px] space-y-1.5 overflow-y-auto overscroll-contain pr-1')}>
            {items.map((item) => (
              <div
                key={item.chave}
                className="flex items-center justify-between gap-2 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-[var(--ink)]">{item.label}</p>
                  {item.detalhe ? <p className="truncate text-[11px] text-[var(--ink-3)]">{item.detalhe}</p> : null}
                </div>
                <span className="mono shrink-0 text-[13px] font-bold text-[var(--brand)]">{item.total}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
