'use client';

import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

const PAGE_SIZE_OPTIONS = [50, 100, 200, 500, 1000] as const;

export function ListPagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  allSelected,
  compact,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number | 'TODOS') => void;
  allSelected?: boolean;
  compact?: boolean;
}) {
  const totalPages = allSelected ? 1 : Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const from = total === 0 ? 0 : allSelected ? 1 : (safePage - 1) * pageSize + 1;
  const to = allSelected ? total : Math.min(safePage * pageSize, total);

  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? 'justify-between' : 'justify-between'}`}>
      <p className="text-[12px] text-[var(--ink-3)]">
        {total === 0 ? 'Nenhum registro' : `Exibindo ${from}-${to} de ${total}`}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <Select
          value={allSelected ? 'TODOS' : String(pageSize)}
          onChange={(event) => {
            const value = event.target.value;
            onPageSizeChange(value === 'TODOS' ? 'TODOS' : Number(value));
          }}
          className="h-8 w-[92px] py-0 text-[12px]"
          aria-label="Registros por página"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
          <option value="TODOS">Todos</option>
        </Select>
        <Button type="button" variant="outlined" size="sm" className="h-8 w-8 p-0" disabled={safePage <= 1 || allSelected} onClick={() => onPageChange(1)} aria-label="Primeira página">
          <ChevronFirst className="h-4 w-4" />
        </Button>
        <Button type="button" variant="outlined" size="sm" className="h-8 w-8 p-0" disabled={safePage <= 1 || allSelected} onClick={() => onPageChange(safePage - 1)} aria-label="Página anterior">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <input
          type="number"
          min={1}
          max={totalPages}
          value={safePage}
          disabled={allSelected}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (!Number.isFinite(next)) return;
            onPageChange(Math.min(Math.max(1, Math.trunc(next)), totalPages));
          }}
          className="h-8 w-12 rounded-[var(--r-sm)] border border-[var(--line)] bg-[var(--surface)] text-center text-[12px]"
          aria-label="Número da página"
        />
        <span className="text-[12px] text-[var(--ink-3)]">/ {totalPages}</span>
        <Button type="button" variant="outlined" size="sm" className="h-8 w-8 p-0" disabled={safePage >= totalPages || allSelected} onClick={() => onPageChange(safePage + 1)} aria-label="Próxima página">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button type="button" variant="outlined" size="sm" className="h-8 w-8 p-0" disabled={safePage >= totalPages || allSelected} onClick={() => onPageChange(totalPages)} aria-label="Última página">
          <ChevronLast className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
