'use client';

import dynamic from 'next/dynamic';
import { UnidadeOperacional } from '@/lib/types';

const OperationalMapClient = dynamic(
  () => import('./operational-map-client').then((module) => module.OperationalMapClient),
  {
    ssr: false,
    loading: () => (
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-950">Mapa CCO</h2>
          <p className="text-sm text-slate-600">Carregando mapa de Franca/SP...</p>
        </div>
        <div className="flex h-[420px] items-center justify-center rounded-2xl border border-blue-100 bg-slate-100 text-sm text-slate-500">
          Inicializando mapa...
        </div>
      </section>
    ),
  },
);

export function OperationalMap({ unidades }: { unidades: UnidadeOperacional[] }) {
  return <OperationalMapClient unidades={unidades} />;
}
