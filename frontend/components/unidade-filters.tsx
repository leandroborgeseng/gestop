'use client';

import { SlidersHorizontal } from 'lucide-react';
import { SecretariaOption, UnidadeFilters } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

const tipos = [
  ['ESCOLA', 'Escola'],
  ['UBS', 'UBS'],
  ['PRACA', 'Praça'],
  ['PREDIO_ADMINISTRATIVO', 'Prédio administrativo'],
  ['ESPACO_ESPORTIVO', 'Espaço esportivo'],
  ['OUTRO', 'Outro'],
];

const situacoes = [
  ['OPERACIONAL', 'Operacional'],
  ['COM_PENDENCIAS', 'Com pendências'],
  ['SEM_LOCALIZACAO', 'Sem localização'],
  ['INATIVA', 'Inativa'],
];

export function UnidadeFiltersPanel({
  filters,
  secretarias,
  bairros,
  onChange,
}: {
  filters: UnidadeFilters;
  secretarias: SecretariaOption[];
  bairros: string[];
  onChange: (filters: UnidadeFilters) => void;
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

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-[var(--color-brand-primary)]" />
            Consulta de próprios
          </CardTitle>
          <CardDescription className="mt-1">
            Filtre a lista e o mapa de forma sincronizada.
            {activeCount > 0 ? ` ${activeCount} filtro(s) ativo(s).` : ''}
          </CardDescription>
        </div>
        <Button variant="secondary" size="sm" onClick={clear}>
          Limpar
        </Button>
      </CardHeader>

      <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Field label="Busca">
          <Input
            value={filters.search ?? ''}
            onChange={(event) => update('search', event.target.value)}
            placeholder="Nome, endereço, código ou secretaria"
          />
        </Field>

        <Field label="Secretaria">
          <Select
            value={filters.secretariaId ?? ''}
            onChange={(event) => update('secretariaId', event.target.value)}
          >
            <option value="">Todas</option>
            {secretarias.map((secretaria) => (
              <option key={secretaria.id} value={secretaria.id}>
                {secretaria.sigla} - {secretaria.nome}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Tipo">
          <Select value={filters.tipo ?? ''} onChange={(event) => update('tipo', event.target.value)}>
            <option value="">Todos</option>
            {tipos.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Situação">
          <Select
            value={filters.situacao ?? ''}
            onChange={(event) => update('situacao', event.target.value)}
          >
            <option value="">Todas</option>
            {situacoes.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Pendências">
          <Select
            value={filters.pendencias ?? ''}
            onChange={(event) => update('pendencias', event.target.value)}
          >
            <option value="">Todas</option>
            <option value="true">Somente com pendências</option>
            <option value="false">Sem pendências</option>
          </Select>
        </Field>

        <Field label="Bairro">
          <Select value={filters.bairro ?? ''} onChange={(event) => update('bairro', event.target.value)}>
            <option value="">Todos</option>
            {bairros.map((bairro) => (
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
