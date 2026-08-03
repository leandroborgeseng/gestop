'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ValidarDocumentoPublico } from '@/components/documentos/validar-documento-publico';
import { LoadingState } from '@/components/ui-states';

export default function ValidarDocumentoPorLinkPage() {
  return (
    <Suspense fallback={<LoadingState label="Carregando validação..." />}>
      <ValidarDocumentoPorLinkContent />
    </Suspense>
  );
}

function ValidarDocumentoPorLinkContent() {
  const params = useParams<{ codigo: string }>();
  const searchParams = useSearchParams();
  const codigoParam = decodeURIComponent(params.codigo ?? '').toUpperCase();
  const verificadorParam = (searchParams.get('v') || searchParams.get('verificador') || '').toUpperCase();

  return (
    <ValidarDocumentoPublico
      codigoValidacaoInicial={codigoParam}
      verificadorInicial={verificadorParam}
      autoConsultar
    />
  );
}
