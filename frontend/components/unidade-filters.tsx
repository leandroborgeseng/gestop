'use client';

import { SlidersHorizontal } from 'lucide-react';
import { UnidadeFilters, UnidadeFiltroOpcoes } from '@/lib/types';
import { formatUnidadeTipo } from '@/lib/unidade-tipo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

const situacoes = [
  ['OPERACIONAL', 'Operacional'],
  ['COM_PENDENCIAS', 'Com pendências'],
  ['SEM_LOCALIZACAO', 'Sem localização'],
  ['INATIVA', 'Inativa'],
];

export function UnidadeFiltersPanel({
  filters,
  opcoes,
  onChange,
  embedded = false,
}: {
  filters: UnidadeFilters;
  opcoes: UnidadeFiltroOpcoes | null;
  onChange: (filters: UnidadeFilters) => void;
  embedded?: boolean;
}) {
  function update(key: keyof UnidadeFilters, value: string) {
    onChange({
      ...filters,
      [key]: value || undefined,
    });
  }

  function clear() {
    onChange({});
  }

  const activeCount = Object.values(filters).filter(Boolean).length;

  if (embedded) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Responsável">
          <Select value={filters.responsavel ?? ''} onChange={(event) => update('responsavel', event.target.value)}>
            <option value="">Todos</option>
            {(opcoes?.responsaveis ?? []).map((item) => (
              <option key={`${item.secretariaId}-${item.nome}`} value={item.nome}>
                {item.nome} · {item.secretariaSigla}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="E-mail">
          <Select value={filters.responsavelEmail ?? ''} onChange={(event) => update('responsavelEmail', event.target.value)}>
            <option value="">Todos</option>
            {(opcoes?.emails ?? []).map((email) => (
              <option key={email} value={email}>{email}</option>
            ))}
          </Select>
        </Field>
        <Field label="Tipo">
          <Select value={filters.tipo ?? ''} onChange={(event) => update('tipo', event.target.value)}>
            <option value="">Todos</option>
            {(opcoes?.tipos ?? []).map((tipo) => (
              <option key={tipo} value={tipo}>{formatUnidadeTipo(tipo)}</option>
            ))}
          </Select>
        </Field>
      </div>
    );
  }

  return (
    <Card elevation={1}>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-[var(--color-brand-primary)]" />
            Consulta de próprios
          </CardTitle>
          <CardDescription className="mt-1">
            Filtre a lista e o mapa de forma sincronizada. Listas carregadas dos dados importados.
            {activeCount > 0 ? ` ${activeCount} filtro(s) ativo(s).` : ''}
          </CardDescription>
        </div>
        <Button variant="text" size="sm" onClick={clear}>
          Limpar
        </Button>
      </CardHeader>

      <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Field label="Busca">
          <Input
            value={filters.search ?? ''}
            onChange={(event) => update('search', event.target.value)}
            placeholder="Nome, código ou endereço"
            list="sigma-unidade-busca-sugestoes"
          />
          {opcoes ? (
            <datalist id="sigma-unidade-busca-sugestoes">
              {opcoes.bairros.map((bairro) => (
                <option key={bairro} value={bairro} />
              ))}
              {opcoes.secretarias.map((secretaria) => (
                <option key={secretaria.id} value={secretaria.sigla} />
              ))}
            </datalist>
          ) : null}
        </Field>

        <Field label="Responsável (secretaria)">
          <Select value={filters.responsavel ?? ''} onChange={(event) => update('responsavel', event.target.value)}>
            <option value="">Todos</option>
            {(opcoes?.responsaveis ?? []).map((item) => (
              <option key={`${item.secretariaId}-${item.nome}`} value={item.nome}>
                {item.nome} · {item.secretariaSigla}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="E-mail do responsável">
          <Select
            value={filters.responsavelEmail ?? ''}
            onChange={(event) => update('responsavelEmail', event.target.value)}
          >
            <option value="">Todos</option>
            {(opcoes?.emails ?? []).map((email) => (
              <option key={email} value={email}>
                {email}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Secretaria">
          <Select value={filters.secretariaId ?? ''} onChange={(event) => update('secretariaId', event.target.value)}>
            <option value="">Todas</option>
            {(opcoes?.secretarias ?? []).map((secretaria) => (
              <option key={secretaria.id} value={secretaria.id}>
                {secretaria.sigla} — {secretaria.nome}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Tipo">
          <Select value={filters.tipo ?? ''} onChange={(event) => update('tipo', event.target.value)}>
            <option value="">Todos</option>
            {(opcoes?.tipos ?? []).map((tipo) => (
              <option key={tipo} value={tipo}>
                {formatUnidadeTipo(tipo)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Situação">
          <Select value={filters.situacao ?? ''} onChange={(event) => update('situacao', event.target.value)}>
            <option value="">Todas</option>
            {situacoes.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Bairro">
          <Select value={filters.bairro ?? ''} onChange={(event) => update('bairro', event.target.value)}>
            <option value="">Todos</option>
            {(opcoes?.bairros ?? []).map((bairro) => (
              <option key={bairro} value={bairro}>
                {bairro}
              </option>
            ))}
          </Select>
        </Field>
      </CardContent>
    </Card>
  );
}
