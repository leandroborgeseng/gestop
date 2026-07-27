'use client';

import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { PlusCircle } from 'lucide-react';
import { AbrirChamadoForm } from '@/components/chamados/abrir-chamado-form';
import { RequirePermissions } from '@/components/auth/require-permissions';
import { useSessionUser } from '@/components/auth/session-context';
import { PageShell } from '@/components/layout/page-shell';
import { TipBanner } from '@/components/help/tip-banner';
import { LoadingState } from '@/components/ui-states';
import { getStoredAuth } from '@/lib/api';
import { hasChamadosGerenciar } from '@/lib/navigation';

export default function NovoChamadoPage() {
  return (
    <Suspense fallback={<LoadingState label="Carregando formulário..." />}>
      <NovoChamadoPageContent />
    </Suspense>
  );
}

function NovoChamadoPageContent() {
  const searchParams = useSearchParams();
  const sessionUser = useSessionUser();
  const unidadeId = searchParams.get('unidadeId') ?? undefined;
  const unidadeNome = searchParams.get('unidadeNome') ?? undefined;

  const canManageChamados = useMemo(() => {
    const permissions = sessionUser?.permissoes ?? getStoredAuth()?.user.permissoes ?? [];
    return hasChamadosGerenciar(permissions);
  }, [sessionUser]);

  return (
    <RequirePermissions permissions={['chamados.abrir']}>
      <PageShell
        kicker="Chamados"
        icon={PlusCircle}
        title="Novo chamado"
        description="Registro simplificado com foto georeferenciada. Escolha se o chamado é por próprio, geolocalização ou endereço."
        backHref={canManageChamados ? '/chamados' : undefined}
      >
        <TipBanner id="chamados-novo-localizacao">
          Use <b>geolocalização</b> ou <b>endereço</b> para ocorrências em via pública (ex.: tapa-buraco) sem vincular a um próprio.
          Ajuste o pin no mapa antes de salvar, como no Uber.
        </TipBanner>
        <AbrirChamadoForm
          initialUnidadeId={unidadeId}
          initialUnidadeNome={unidadeNome}
          redirectOnSuccess={canManageChamados}
        />
      </PageShell>
    </RequirePermissions>
  );
}
