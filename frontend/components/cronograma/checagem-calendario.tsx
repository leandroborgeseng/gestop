'use client';

import Link from 'next/link';
import { CalendarioChecagemEvento } from '@/lib/types';
import { cn } from '@/lib/cn';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const tipoStyles: Record<CalendarioChecagemEvento['tipo'], string> = {
  AGENDADA: 'border-[var(--brand-soft)] bg-[var(--brand-soft)] text-[var(--brand-hover)]',
  REALIZADA: 'border-[var(--ok-bd)] bg-[var(--ok-bg)] text-[var(--ok)]',
  ATRASADA: 'border-[var(--warn-bd)] bg-[var(--warn-bg)] text-[var(--warn)]',
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
    <div className="rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--sh-sm)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onPrevMonth}
          className="rounded-[var(--r-sm)] px-3 py-2 text-[13px] font-semibold text-[var(--brand)] hover:bg-[var(--surface-2)]"
        >
          ← Anterior
        </button>
        <h2 className="text-[15px] font-bold capitalize text-[var(--ink)]">{monthLabel}</h2>
        <button
          type="button"
          onClick={onNextMonth}
          className="rounded-[var(--r-sm)] px-3 py-2 text-[13px] font-semibold text-[var(--brand)] hover:bg-[var(--surface-2)]"
        >
          Próximo →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {WEEKDAYS.map((day) => (
          <div key={day} className="py-2 text-center text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">
            {day}
          </div>
        ))}

        {cells.map((cell) => {
          if (!cell.date) {
            return <div key={cell.key} className="min-h-24 rounded-[var(--r-sm)] bg-transparent" />;
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
                'min-h-24 rounded-[var(--r-sm)] border p-2 text-left transition-colors',
                isSelected
                  ? 'border-[var(--brand)] bg-[var(--brand-soft)]'
                  : 'border-[var(--line)] bg-[var(--surface-2)] hover:bg-[var(--surface)]',
              )}
            >
              <span
                className={cn(
                  'inline-flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-semibold',
                  isToday && 'bg-[var(--brand)] text-white',
                  !isToday && 'text-[var(--ink)]',
                )}
              >
                {cell.date.getDate()}
              </span>
              <div className="mt-2 space-y-1">
                {eventos.slice(0, 2).map((evento) => (
                  <span
                    key={evento.id}
                    className={cn(
                      'block truncate rounded border px-1.5 py-0.5 text-[10px] font-medium leading-tight',
                      tipoStyles[evento.tipo],
                    )}
                  >
                    {evento.unidade.nome}
                  </span>
                ))}
                {eventos.length > 2 ? (
                  <span className="text-[11px] text-[var(--ink-3)]">+{eventos.length - 2}</span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-[12px] text-[var(--ink-3)]">
        <Legend color="bg-[var(--brand)]" label="Agendada" />
        <Legend color="bg-[var(--ok)]" label="Realizada" />
        <Legend color="bg-[var(--warn)]" label="Atrasada" />
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
    <div className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('rounded-[var(--r-pill)] border px-2.5 py-1 text-[11px] font-semibold', tipoStyles[evento.tipo])}>
          {evento.tipo === 'REALIZADA' ? 'Realizada' : evento.tipo === 'ATRASADA' ? 'Atrasada' : 'Agendada'}
        </span>
        <span className="mono text-[11px] text-[var(--ink-3)]">{evento.data}</span>
      </div>
      <h3 className="mt-2 text-[14px] font-semibold text-[var(--ink)]">{evento.unidade.nome}</h3>
      <p className="mt-1 text-[13px] text-[var(--ink-3)]">
        {evento.checklist.nome} · {evento.unidade.secretariaSigla}
      </p>
      {evento.agenteNome ? (
        <p className="mt-1 text-[13px] text-[var(--ink-3)]">Agente: {evento.agenteNome}</p>
      ) : null}
      <Link
        href={`/cco/unidades/${evento.unidade.id}`}
        className="mt-3 inline-flex text-[13px] font-semibold text-[var(--brand)] hover:underline"
      >
        Ver próprio →
      </Link>
    </div>
  );
}
