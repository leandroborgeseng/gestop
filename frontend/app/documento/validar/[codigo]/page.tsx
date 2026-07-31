'use client';

import { Suspense, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui-states';
import { getPublicDocumentoValidacao } from '@/lib/api';
import { DOCUMENTO_SITUACAO_META, DOCUMENTO_TIPO_LABELS } from '@/lib/documento-status';
import { DocumentoValidacaoPublica } from '@/lib/types';

export default function ValidarDocumentoPage() {
  return (
    <Suspense fallback={<LoadingState label="Carregando validação..." />}>
      <ValidarDocumentoPageContent />
    </Suspense>
  );
}

function ValidarDocumentoPageContent() {
  const params = useParams<{ codigo: string }>();
  const searchParams = useSearchParams();
  const codigoParam = decodeURIComponent(params.codigo ?? '').toUpperCase();
  const verificadorParam = (searchParams.get('v') || searchParams.get('verificador') || '').toUpperCase();
  const [codigo, setCodigo] = useState(codigoParam);
  const [verificador, setVerificador] = useState(verificadorParam);
  const [data, setData] = useState<DocumentoValidacaoPublica | null>(null);
  const [loading, setLoading] = useState(Boolean(codigoParam));
  const [error, setError] = useState<string | null>(null);

  function consultar(nextCodigo = codigo, nextVerificador = verificador) {
    if (!nextCodigo.trim()) return;
    setLoading(true);
    setError(null);
    getPublicDocumentoValidacao(nextCodigo.trim(), nextVerificador.trim() || undefined)
      .then(setData)
      .catch((err) => {
        setData(null);
        setError(err instanceof Error ? err.message : 'Documento não encontrado.');
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!codigoParam) return;
    consultar(codigoParam, verificadorParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigoParam, verificadorParam]);

  const situacao = data ? DOCUMENTO_SITUACAO_META[data.situacao] : null;

  return (
    <main className="min-h-dvh bg-[#e7ecf3] px-4 py-7 font-[family-name:var(--font-sans)]">
      <div className="mx-auto w-full max-w-md overflow-hidden rounded-[20px] bg-[var(--canvas)] shadow-[var(--sh-lg)]">
        <header className="bg-gradient-to-br from-[var(--brand-hover)] to-[var(--brand-bright)] px-[18px] pt-[18px] pb-[22px] text-white">
          <div className="flex items-center gap-3">
            <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[11px] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.12)]">
              <Image src="/franca-mark.png" alt="PMF" width={26} height={31} className="object-contain" />
            </span>
            <div>
              <p className="text-[15px] font-bold leading-tight">Prefeitura de Franca</p>
              <p className="text-[11px] opacity-90">Validação pública de documento</p>
            </div>
          </div>
        </header>

        <div className="space-y-4 p-5">
          <div className="space-y-2">
            <Field label="Código de validação">
              <Input value={codigo} onChange={(event) => setCodigo(event.target.value.toUpperCase())} />
            </Field>
            <Field label="Código verificador (opcional no QR, obrigatório para confirmação reforçada)">
              <Input value={verificador} onChange={(event) => setVerificador(event.target.value.toUpperCase())} />
            </Field>
            <Button type="button" variant="filled" className="w-full" onClick={() => consultar()}>
              Validar documento
            </Button>
          </div>

          {loading ? <LoadingState label="Validando documento..." /> : null}
          {error ? <Alert variant="error">{error}</Alert> : null}

          {data ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="mono text-[16px] font-bold text-[var(--brand-hover)]">{data.codigo}</p>
                {situacao ? <Badge variant={situacao.badge}>{situacao.label}</Badge> : null}
                <Badge variant={data.valido ? 'success' : 'danger'}>
                  {data.valido ? 'Documento válido/vigente' : 'Documento inválido ou cancelado'}
                </Badge>
              </div>

              <div className="space-y-1 text-[13px] text-[var(--ink-2)]">
                <p className="font-semibold text-[var(--ink)]">{data.titulo}</p>
                <p>
                  <strong>Tipo:</strong> {DOCUMENTO_TIPO_LABELS[data.tipo]}
                </p>
                <p>
                  <strong>Secretaria:</strong> {data.secretaria.sigla} · {data.secretaria.nome}
                </p>
                {data.unidade ? (
                  <p>
                    <strong>Próprio:</strong> {data.unidade.codigoPatrimonial} · {data.unidade.nome}
                  </p>
                ) : null}
                {data.chamadoCodigo ? (
                  <p>
                    <strong>Chamado:</strong> {data.chamadoCodigo}
                  </p>
                ) : null}
                <p className="text-[12px] text-[var(--ink-3)]">
                  Criado em {new Date(data.criadoEm).toLocaleString('pt-BR')}
                </p>
                <p className="text-[12px] text-[var(--ink-3)]">
                  PDF original: {data.possuiPdfOriginal ? 'sim' : 'não'} · PDF assinado:{' '}
                  {data.possuiPdfAssinado ? 'sim' : 'não'}
                </p>
              </div>

              {data.assinaturas.length ? (
                <div>
                  <p className="mb-2 text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">Assinaturas</p>
                  <ul className="space-y-2 text-[12px]">
                    {data.assinaturas.map((item, index) => (
                      <li key={`${item.assinanteNome}-${index}`} className="rounded-[10px] border border-[var(--line)] p-2">
                        <p className="font-semibold text-[var(--ink)]">{item.assinanteNome}</p>
                        <p className="text-[var(--ink-3)]">
                          {item.qualificacao ?? '—'} · CPF {item.assinanteDocumento ?? '***'} · E-mail{' '}
                          {item.assinanteEmail ?? '***'}
                        </p>
                        <p className="text-[var(--ink-3)]">{new Date(item.coletadaEm).toLocaleString('pt-BR')}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          <p className="text-center text-[12px]">
            <Link href="/login" className="text-[var(--brand-hover)] underline-offset-2 hover:underline">
              Ir para o login do SIGMA
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
