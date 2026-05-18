import { AlertTriangle, Loader2, MapPinOff } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function LoadingState({ label = 'Carregando dados operacionais...' }: { label?: string }) {
  return (
    <Card>
      <CardContent className="flex min-h-40 items-center justify-center py-10 text-zinc-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-[var(--color-brand-primary)]" aria-hidden />
        <span className="text-sm font-medium">{label}</span>
      </CardContent>
    </Card>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-12 text-center">
        <MapPinOff className="mx-auto mb-3 h-8 w-8 text-zinc-400" aria-hidden />
        <h3 className="text-base font-semibold text-zinc-950">{title}</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">{description}</p>
      </CardContent>
    </Card>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <Card className="border-red-200/80 bg-red-50/50">
      <CardContent className="py-5">
        <div className="flex items-start gap-3 text-red-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">Não foi possível carregar</p>
            <p className="mt-1 text-sm leading-6 text-red-800/90">{message}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
