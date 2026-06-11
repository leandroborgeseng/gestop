'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { HardHat } from 'lucide-react';
import { RequirePermissions } from '@/components/auth/require-permissions';
import { ChamadoExecucaoFlow } from '@/components/chamados/chamado-execucao-flow';
import { PageShell } from '@/components/layout/page-shell';
import { TipBanner } from '@/components/help/tip-banner';
import { LoadingState } from '@/components/ui-states';

export default function ChamadoExecucaoPage() {
  const params = useParams<{ id: string }>();
  const chamadoId = params.id;

  if (!chamadoId) {
    return <LoadingState label="Abrindo execução..." />;
  }

  return (
    <RequirePermissions permissions={['chamados.gerenciar', 'chamados.executar']} match="any">
      <PageShell
        kicker="Execução de campo"
        icon={HardHat}
        title="Ordem de serviço em campo"
        description="Fluxo guiado para o executante: check-in GPS, registro do serviço e evidências fotográficas."
        backHref="/chamados/em-execucao"
      >
        <TipBanner id="chamado-execucao-campo">
          Confirme presença no local, descreva o serviço realizado e anexe fotos. Ao concluir, o chamado será encerrado
          automaticamente na fila operacional.
        </TipBanner>

        <Suspense fallback={<LoadingState label="Abrindo execução..." />}>
          <ChamadoExecucaoFlow chamadoId={chamadoId} />
        </Suspense>
      </PageShell>
    </RequirePermissions>
  );
}
