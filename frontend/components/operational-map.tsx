'use client';

import dynamic from 'next/dynamic';
import { UnidadeOperacional } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const OperationalMapClient = dynamic(
  () => import('./operational-map-client').then((module) => module.OperationalMapClient),
  {
    ssr: false,
    loading: () => (
      <Card>
        <CardContent className="space-y-4 p-5">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-[min(420px,60dvh)] w-full" />
        </CardContent>
      </Card>
    ),
  },
);

export function OperationalMap({ unidades }: { unidades: UnidadeOperacional[] }) {
  return <OperationalMapClient unidades={unidades} />;
}
