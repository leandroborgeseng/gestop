import { Loader2, MapPinOff, SearchX } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function LoadingState({ label = 'Carregando dados...' }: { label?: string }) {
  return (
    <Card elevation={1}>
      <CardContent className="flex min-h-44 flex-col items-center justify-center gap-3 py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--color-brand-primary)]" aria-hidden />
        <span className="md-body-md text-[var(--md-on-surface-variant)]">{label}</span>
      </CardContent>
    </Card>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Card elevation={0} className="border-dashed bg-[var(--md-surface-container-low)]">
      <CardContent className="flex flex-col items-center py-14 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[var(--md-shape-full)] bg-[var(--md-surface-container)]">
          <SearchX className="h-7 w-7 text-[var(--md-on-surface-variant)]" aria-hidden />
        </div>
        <h3 className="md-title-lg text-[var(--md-on-surface)]">{title}</h3>
        <p className="md-body-md mt-2 max-w-md text-[var(--md-on-surface-variant)]">{description}</p>
        {action ? <div className="mt-6">{action}</div> : null}
      </CardContent>
    </Card>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <Card elevation={1} className="border-red-200 bg-red-50/60">
      <CardContent className="flex items-start gap-4 py-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--md-shape-full)] bg-red-100">
          <MapPinOff className="h-5 w-5 text-red-700" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="md-title-md text-red-900">Não foi possível carregar</p>
          <p className="md-body-md mt-1 text-red-800/90">{message}</p>
          {onRetry ? (
            <Button variant="tonal" size="sm" className="mt-4" onClick={onRetry}>
              Tentar novamente
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
