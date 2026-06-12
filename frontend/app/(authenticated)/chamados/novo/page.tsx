'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Bell } from 'lucide-react';
import { AbrirChamadoForm } from '@/components/chamados/abrir-chamado-form';
import { RequirePermissions } from '@/components/auth/require-permissions';
import { PageShell } from '@/components/layout/page-shell';
import { TipBanner } from '@/components/help/tip-banner';
import { LoadingState } from '@/components/ui-states';

export default function NovoChamadoPage() {
  return (
    <Suspense fallback={<LoadingState label="Carregando formulário..." />}>
      <NovoChamadoPageContent />
    </Suspense>
  );
}

function NovoChamadoPageContent() {
  const searchParams = useSearchParams();
  const unidadeId = searchParams.get('unidadeId') ?? undefined;
  const unidadeNome = searchParams.get('unidadeNome') ?? undefined;

  return (
    <RequirePermissions permissions={['chamados.gerenciar']}>
      <PageShell
        kicker="Chamados"
        icon={Bell}
        title="Abrir chamado"
        description="Registro simplificado com foto georeferenciada. Escolha se o chamado é por próprio, geolocalização ou endereço."
        backHref="/chamados"
      >
        <TipBanner id="chamados-novo-localizacao">
          Use <b>geolocalização</b> ou <b>endereço</b> para ocorrências em via pública (ex.: tapa-buraco) sem vincular a um próprio.
          Ajuste o pin no mapa antes de salvar, como no Uber.
        </TipBanner>
        <AbrirChamadoForm initialUnidadeId={unidadeId} initialUnidadeNome={unidadeNome} />
      </PageShell>
    </RequirePermissions>
  );
}
