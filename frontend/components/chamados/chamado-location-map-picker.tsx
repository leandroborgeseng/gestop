'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const ChamadoLocationMapPickerClient = dynamic(
  () =>
    import('./chamado-location-map-picker-client').then((module) => module.ChamadoLocationMapPickerClient),
  {
    ssr: false,
    loading: () => (
      <div className="overflow-hidden rounded-[var(--r-md)] border border-[var(--line)]">
        <Skeleton className="h-[220px] w-full rounded-none" />
      </div>
    ),
  },
);

export function ChamadoLocationMapPicker(props: {
  latitude: number | null;
  longitude: number | null;
  onChange: (coords: { latitude: number; longitude: number }) => void;
  className?: string;
}) {
  return <ChamadoLocationMapPickerClient {...props} />;
}
