'use client';

import Link from 'next/link';
import { CalendarioChecagemEvento } from '@/lib/types';
import { cn } from '@/lib/cn';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const tipoStyles: Record<CalendarioChecagemEvento['tipo'], string> = {
  AGENDADA: 'bg-sky-100 text-sky-900 border-sky-200',
  REALIZADA: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  ATRASADA: 'bg-amber-100 text-amber-950 border-amber-200',
};

export function ChecagemCalendario({
  month,
  eventosPorDia,
  selectedDate,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
}: {
  month: Date;
  eventosPorDia: Map<string, CalendarioChecagemEvento[]>;
  selectedDate: string | null;
  onSelectDate: (dateKey: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}) {
  const cells = buildCells(month);
  const monthLabel = month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="rounded-[var(--md-shape-lg)] border border-[var(--md-outline-variant)] bg-[var(--md-surface)] p-4 shadow-[var(--md-elevation-1)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onPrevMonth}
          className="rounded-[var(--md-shape-sm)] px-3 py-2 md-label-lg text-[var(--color-brand-primary)] hover:bg-[var(--md-surface-container-low)]"
        >
          ← Anterior
        </button>
        <h2 className="md-title-lg capitalize text-[var(--md-on-surface)]">{monthLabel}</h2>
        <button
          type="button"
          onClick={onNextMonth}
          className="rounded-[var(--md-shape-sm)] px-3 py-2 md-label-lg text-[var(--color-brand-primary)] hover:bg-[var(--md-surface-container-low)]"
        >
          Próximo →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {WEEKDAYS.map((day) => (
          <div key={day} className="md-label-md py-2 text-center text-[var(--md-on-surface-variant)]">
            {day}
          </div>
        ))}

        {cells.map((cell) => {
          if (!cell.date) {
            return <div key={cell.key} className="min-h-24 rounded-[var(--md-shape-sm)] bg-transparent" />;
          }

          const dateKey = cell.date.toISOString().slice(0, 10);
          const eventos = eventosPorDia.get(dateKey) ?? [];
          const isSelected = selectedDate === dateKey;
          const isToday = dateKey === new Date().toISOString().slice(0, 10);

          return (
            <button
              key={cell.key}
              type="button"
              onClick={() => onSelectDate(dateKey)}
              className={cn(
                'min-h-24 rounded-[var(--md-shape-sm)] border p-2 text-left transition-colors',
                isSelected
                  ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-subtle)]'
                  : 'border-[var(--md-outline-variant)] bg-[var(--md-surface-container-lowest)] hover:bg-[var(--md-surface-container-low)]',
              )}
            >
              <span
                className={cn(
                  'inline-flex h-7 w-7 items-center justify-center rounded-full md-label-lg',
                  isToday && 'bg-[var(--color-brand-primary)] text-white',
                )}
              >
                {cell.date.getDate()}
              </span>
              <div className="mt-2 space-y-1">
                {eventos.slice(0, 2).map((evento) => (
                  <span
                    key={evento.id}
                    className={cn(
                      'block truncate rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight border',
                      tipoStyles[evento.tipo],
                    )}
                  >
                    {evento.unidade.nome}
                  </span>
                ))}
                {eventos.length > 2 ? (
                  <span className="md-label-md text-[var(--md-on-surface-variant)]">+{eventos.length - 2}</span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-3 md-label-md text-[var(--md-on-surface-variant)]">
        <Legend color="bg-sky-500" label="Agendada" />
        <Legend color="bg-emerald-500" label="Realizada" />
        <Legend color="bg-amber-500" label="Atrasada" />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn('h-2.5 w-2.5 rounded-full', color)} />
      {label}
    </span>
  );
}

function buildCells(reference: Date) {
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 0);
  const cells: Array<{ date: Date | null; key: string }> = [];
  const leading = start.getDay();

  for (let index = 0; index < leading; index += 1) {
    cells.push({ date: null, key: `empty-start-${index}` });
  }

  for (let day = 1; day <= end.getDate(); day += 1) {
    const date = new Date(reference.getFullYear(), reference.getMonth(), day);
    cells.push({ date, key: date.toISOString().slice(0, 10) });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ date: null, key: `empty-end-${cells.length}` });
  }

  return cells;
}

export function EventoChecagemCard({ evento }: { evento: CalendarioChecagemEvento }) {
  return (
    <div className="rounded-[var(--md-shape-md)] border border-[var(--md-outline-variant)] bg-[var(--md-surface-container-low)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('rounded-full px-2.5 py-1 md-label-md border', tipoStyles[evento.tipo])}>
          {evento.tipo === 'REALIZADA' ? 'Realizada' : evento.tipo === 'ATRASADA' ? 'Atrasada' : 'Agendada'}
        </span>
        <span className="md-label-md text-[var(--md-on-surface-variant)]">{evento.data}</span>
      </div>
      <h3 className="md-title-md mt-2 text-[var(--md-on-surface)]">{evento.unidade.nome}</h3>
      <p className="md-body-md mt-1 text-[var(--md-on-surface-variant)]">
        {evento.checklist.nome} · {evento.unidade.secretariaSigla}
      </p>
      {evento.agenteNome ? (
        <p className="md-body-md mt-1 text-[var(--md-on-surface-variant)]">Agente: {evento.agenteNome}</p>
      ) : null}
      <Link
        href={`/cco/unidades/${evento.unidade.id}`}
        className="md-label-lg mt-3 inline-flex text-[var(--color-brand-primary)]"
      >
        Ver próprio →
      </Link>
    </div>
  );
}
