'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { TipoChamadoOpcao } from '@/lib/types';

export function TipoChamadoSelect({
  value,
  onChange,
  tipos,
  disabled,
  required,
  id,
  emptyLabel = 'Selecione o tipo de chamado',
  allowEmpty = false,
  emptyOptionLabel = 'Todos os tipos',
  searchable = true,
}: {
  value: string;
  onChange: (value: string) => void;
  tipos: TipoChamadoOpcao[];
  disabled?: boolean;
  required?: boolean;
  id?: string;
  emptyLabel?: string;
  allowEmpty?: boolean;
  emptyOptionLabel?: string;
  searchable?: boolean;
}) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tipos;
    return tipos.filter((tipo) => tipo.nome.toLowerCase().includes(q));
  }, [query, tipos]);

  return (
    <div className="space-y-1.5">
      {searchable && tipos.length > 8 ? (
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Pesquisar tipo…"
          disabled={disabled}
          className="h-8 text-xs"
          aria-label="Pesquisar tipo de chamado"
        />
      ) : null}
      <Select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        required={required}
      >
        {allowEmpty ? <option value="">{emptyOptionLabel}</option> : <option value="">{emptyLabel}</option>}
        {filtered.map((tipo) => (
          <option key={tipo.id} value={tipo.id}>
            {tipo.nome}
          </option>
        ))}
      </Select>
      {searchable && query.trim() && filtered.length === 0 ? (
        <p className="text-[11px] text-[var(--ink-3)]">Nenhum tipo encontrado para “{query.trim()}”.</p>
      ) : null}
    </div>
  );
}
