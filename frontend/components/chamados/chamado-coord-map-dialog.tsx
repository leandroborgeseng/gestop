'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { FRANCA_CENTER } from '@/lib/franca-geo';
import { cn } from '@/lib/cn';

const CoordMapEditor = dynamic(() => import('./chamado-coord-map-editor').then((m) => m.ChamadoCoordMapEditor), {
  ssr: false,
  loading: () => <div className="h-[min(52vh,420px)] animate-pulse rounded-[var(--r-md)] bg-[var(--surface-2)]" />,
});

export function ChamadoCoordMapDialog({
  open,
  onClose,
  title,
  latitude,
  longitude,
  editable = false,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  latitude: number | null;
  longitude: number | null;
  editable?: boolean;
  onSave?: (coords: { latitude: number; longitude: number }) => void;
}) {
  const [draft, setDraft] = useState({ latitude, longitude });
  const [mapReadyTick, setMapReadyTick] = useState(0);

  useEffect(() => {
    if (!open) return;
    setDraft({
      latitude: latitude ?? FRANCA_CENTER.lat,
      longitude: longitude ?? FRANCA_CENTER.lng,
    });
    // Remonta o mapa após a animação do Sheet para garantir tiles/altura corretos.
    const timer = window.setTimeout(() => setMapReadyTick((value) => value + 1), 80);
    return () => window.clearTimeout(timer);
  }, [open, latitude, longitude]);

  const hasCoords = draft.latitude != null && draft.longitude != null;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      className="md:max-w-2xl"
      footer={
        editable ? (
          <div className="flex gap-2">
            <Button
              variant="filled"
              className="flex-1"
              disabled={!hasCoords}
              onClick={() => {
                if (draft.latitude == null || draft.longitude == null) return;
                onSave?.({ latitude: draft.latitude, longitude: draft.longitude });
                onClose();
              }}
            >
              Salvar coordenadas
            </Button>
            <Button variant="outlined" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        ) : (
          <Button variant="outlined" className="w-full" onClick={onClose}>
            Fechar
          </Button>
        )
      }
    >
      <div className="space-y-3">
        <p className="text-[12px] text-[var(--ink-3)]">
          {editable
            ? 'Arraste o pin ou toque no mapa para reposicionar. Ao salvar, apenas latitude e longitude são atualizadas.'
            : 'Visualização da localização cadastrada. Use o lápis em Coordenadas geográficas para editar.'}
        </p>
        {hasCoords ? (
          <p className={cn('mono text-[12px]', editable ? 'text-[var(--ink)]' : 'text-[var(--ink-3)]')}>
            {draft.latitude!.toFixed(6)}, {draft.longitude!.toFixed(6)}
          </p>
        ) : (
          <p className="text-[13px] text-[var(--ink-3)]">Sem coordenadas registradas.</p>
        )}
        {open ? (
          <CoordMapEditor
            key={`coord-map-${mapReadyTick}-${editable ? 'edit' : 'view'}`}
            latitude={draft.latitude}
            longitude={draft.longitude}
            editable={editable}
            active={open}
            onChange={(coords) => setDraft(coords)}
          />
        ) : null}
      </div>
    </Sheet>
  );
}
