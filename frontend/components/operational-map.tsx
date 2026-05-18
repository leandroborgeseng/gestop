'use client';

import Link from 'next/link';
import { MapPin, MapPinOff } from 'lucide-react';
import { UnidadeOperacional } from '@/lib/types';
import { StatusBadge } from './status-badge';

function getBounds(unidades: UnidadeOperacional[]) {
  const located = unidades.filter((unidade) => unidade.latitude !== null && unidade.longitude !== null);

  if (located.length === 0) {
    return null;
  }

  const latitudes = located.map((unidade) => unidade.latitude as number);
  const longitudes = located.map((unidade) => unidade.longitude as number);

  return {
    minLat: Math.min(...latitudes),
    maxLat: Math.max(...latitudes),
    minLng: Math.min(...longitudes),
    maxLng: Math.max(...longitudes),
  };
}

function markerPosition(unidade: UnidadeOperacional, bounds: NonNullable<ReturnType<typeof getBounds>>) {
  const latRange = bounds.maxLat - bounds.minLat || 0.01;
  const lngRange = bounds.maxLng - bounds.minLng || 0.01;
  const lat = unidade.latitude as number;
  const lng = unidade.longitude as number;

  return {
    left: `${8 + ((lng - bounds.minLng) / lngRange) * 84}%`,
    top: `${92 - ((lat - bounds.minLat) / latRange) * 84}%`,
  };
}

export function OperationalMap({ unidades }: { unidades: UnidadeOperacional[] }) {
  const bounds = getBounds(unidades);
  const semLocalizacao = unidades.filter((unidade) => unidade.latitude === null || unidade.longitude === null);

  if (!bounds) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex min-h-80 flex-col items-center justify-center text-center text-slate-600">
          <MapPinOff className="mb-3 h-10 w-10 text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-900">Nenhuma unidade com localização</h2>
          <p className="mt-1 max-w-md text-sm">
            Cadastre latitude e longitude nos próprios públicos para habilitar a visualização geográfica.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-950">Mapa CCO</h2>
          <p className="text-sm text-slate-600">Visualização georreferenciada dos próprios filtrados.</p>
        </div>
        {semLocalizacao.length > 0 ? (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {semLocalizacao.length} sem localização
          </span>
        ) : null}
      </div>

      <div className="relative min-h-[420px] overflow-hidden rounded-2xl border border-blue-100 bg-blue-50">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(37,99,235,.10)_1px,transparent_1px),linear-gradient(180deg,rgba(37,99,235,.10)_1px,transparent_1px)] bg-[size:42px_42px]" />
        <div className="absolute left-4 top-4 rounded-xl bg-white/90 px-3 py-2 text-xs font-medium text-slate-600 shadow-sm">
          Franca/SP · mapa esquemático
        </div>

        {unidades
          .filter((unidade) => unidade.latitude !== null && unidade.longitude !== null)
          .map((unidade) => {
            const position = markerPosition(unidade, bounds);

            return (
              <Link
                key={unidade.id}
                href={`/cco/unidades/${unidade.id}`}
                className="group absolute -translate-x-1/2 -translate-y-full"
                style={position}
                title={unidade.nome}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-blue-700 shadow-lg ring-2 ring-blue-200 transition group-hover:scale-110 group-hover:ring-blue-500">
                  <MapPin className="h-6 w-6 fill-blue-100" />
                </span>
                <span className="pointer-events-none absolute left-1/2 top-11 hidden w-64 -translate-x-1/2 rounded-xl bg-white p-3 text-left shadow-xl ring-1 ring-slate-200 group-hover:block">
                  <strong className="block text-sm text-slate-950">{unidade.nome}</strong>
                  <span className="mt-1 block text-xs text-slate-600">
                    {unidade.secretaria.sigla} · {unidade.bairro ?? 'bairro não informado'}
                  </span>
                  <span className="mt-2 block">
                    <StatusBadge situacao={unidade.situacao} />
                  </span>
                </span>
              </Link>
            );
          })}
      </div>
    </section>
  );
}
