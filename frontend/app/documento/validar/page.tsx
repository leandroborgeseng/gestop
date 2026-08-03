'use client';

import { Suspense } from 'react';
import { ValidarDocumentoPublico } from '@/components/documentos/validar-documento-publico';
import { LoadingState } from '@/components/ui-states';

export default function ValidarDocumentoManualPage() {
  return (
    <Suspense fallback={<LoadingState label="Carregando validação..." />}>
      <ValidarDocumentoPublico autoConsultar={false} />
    </Suspense>
  );
}
