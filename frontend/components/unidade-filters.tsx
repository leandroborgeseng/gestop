'use client';

import { SecretariaOption, UnidadeFilters } from '@/lib/types';

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

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-950">Consulta de próprios</h2>
          <p className="text-sm text-slate-600">Filtre a lista e o mapa de forma sincronizada.</p>
        </div>
        <button
          type="button"
          onClick={clear}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Limpar
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">
          Busca
          <input
            value={filters.search ?? ''}
            onChange={(event) => update('search', event.target.value)}
            placeholder="Nome, endereço, código ou secretaria"
            className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">
          Secretaria
          <select
            value={filters.secretariaId ?? ''}
            onChange={(event) => update('secretariaId', event.target.value)}
            className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          >
            <option value="">Todas</option>
            {secretarias.map((secretaria) => (
              <option key={secretaria.id} value={secretaria.id}>
                {secretaria.sigla} - {secretaria.nome}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">
          Tipo
          <select
            value={filters.tipo ?? ''}
            onChange={(event) => update('tipo', event.target.value)}
            className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          >
            <option value="">Todos</option>
            {tipos.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">
          Situação
          <select
            value={filters.situacao ?? ''}
            onChange={(event) => update('situacao', event.target.value)}
            className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          >
            <option value="">Todas</option>
            {situacoes.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">
          Pendências
          <select
            value={filters.pendencias ?? ''}
            onChange={(event) => update('pendencias', event.target.value)}
            className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          >
            <option value="">Todas</option>
            <option value="true">Somente com pendências</option>
            <option value="false">Sem pendências</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">
          Bairro
          <select
            value={filters.bairro ?? ''}
            onChange={(event) => update('bairro', event.target.value)}
            className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          >
            <option value="">Todos</option>
            {bairros.map((bairro) => (
              <option key={bairro} value={bairro}>
                {bairro}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
