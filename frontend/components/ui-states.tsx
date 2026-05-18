import { AlertTriangle, Loader2, MapPinOff } from 'lucide-react';

export function LoadingState({ label = 'Carregando dados operacionais...' }: { label?: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-slate-600">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      {label}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <MapPinOff className="mx-auto mb-3 h-8 w-8 text-slate-400" />
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">
      <div className="flex items-center gap-2 font-semibold">
        <AlertTriangle className="h-5 w-5" />
        Não foi possível carregar
      </div>
      <p className="mt-1 text-sm">{message}</p>
    </div>
  );
}
