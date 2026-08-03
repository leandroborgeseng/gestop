'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui-states';
import {
  getPublicDocumentoValidacao,
  getPublicDocumentoValidacaoPorDocumento,
} from '@/lib/api';
import { DOCUMENTO_SITUACAO_META, DOCUMENTO_TIPO_LABELS } from '@/lib/documento-status';
import { DocumentoValidacaoPublica } from '@/lib/types';

type Props = {
  /** Pré-preenchido pelo link/QR (código de validação). */
  codigoValidacaoInicial?: string;
  /** Pré-preenchido pelo link/QR (código verificador). */
  verificadorInicial?: string;
  /** Inicia automaticamente a consulta quando há código de validação no link. */
  autoConsultar?: boolean;
};

function applyResultToFields(
  result: DocumentoValidacaoPublica,
  setters: {
    setCodigoDocumento: (value: string) => void;
    setVerificador: (value: string) => void;
    setCodigoValidacao: (value: string) => void;
  },
) {
  setters.setCodigoDocumento(result.codigo);
  setters.setVerificador(result.codigoVerificador ?? '');
  setters.setCodigoValidacao(result.codigoValidacao);
}

export function ValidarDocumentoPublico({
  codigoValidacaoInicial = '',
  verificadorInicial = '',
  autoConsultar = false,
}: Props) {
  const [codigoDocumento, setCodigoDocumento] = useState('');
  const [verificador, setVerificador] = useState(verificadorInicial);
  const [codigoValidacao, setCodigoValidacao] = useState(codigoValidacaoInicial);
  const [data, setData] = useState<DocumentoValidacaoPublica | null>(null);
  const [loading, setLoading] = useState(Boolean(autoConsultar && codigoValidacaoInicial));
  const [error, setError] = useState<string | null>(null);

  function handleSuccess(result: DocumentoValidacaoPublica, codigoValidacaoInformado?: string) {
    const informado = (codigoValidacaoInformado ?? '').trim().toUpperCase();
    if (informado && informado !== result.codigoValidacao.toUpperCase()) {
      setData(null);
      setError('Os códigos informados não correspondem entre si. Verifique e tente novamente.');
      return;
    }
    applyResultToFields(result, { setCodigoDocumento, setVerificador, setCodigoValidacao });
    setData(result);
    setError(null);
  }

  function consultar() {
    setLoading(true);
    setError(null);
    setData(null);

    const v = verificador.trim().toUpperCase();
    const doc = codigoDocumento.trim().toUpperCase();
    const validacao = codigoValidacao.trim().toUpperCase();

    if (!v) {
      setLoading(false);
      setError('Informe o código verificador.');
      return;
    }

    if (!doc && !validacao) {
      setLoading(false);
      setError('Informe o código do documento (e, se preferir, o código de validação).');
      return;
    }

    const request = doc
      ? getPublicDocumentoValidacaoPorDocumento(doc, v)
      : getPublicDocumentoValidacao(validacao, v);

    request
      .then((result) => handleSuccess(result, validacao || undefined))
      .catch((err) => {
        setData(null);
        setError(
          err instanceof Error
            ? err.message
            : 'Códigos inválidos ou documento não encontrado.',
        );
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!autoConsultar || !codigoValidacaoInicial) return;

    setCodigoValidacao(codigoValidacaoInicial);
    setVerificador(verificadorInicial);
    setLoading(true);
    setError(null);
    setData(null);

    if (!verificadorInicial.trim()) {
      setLoading(false);
      setError('Link incompleto: informe também o código verificador.');
      return;
    }

    getPublicDocumentoValidacao(codigoValidacaoInicial, verificadorInicial)
      .then((result) => handleSuccess(result))
      .catch((err) => {
        setData(null);
        setError(
          err instanceof Error
            ? err.message
            : 'Códigos inválidos ou documento não encontrado.',
        );
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConsultar, codigoValidacaoInicial, verificadorInicial]);

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
          <p className="text-[12px] text-[var(--ink-3)]">
            Para validação manual, informe o <strong>Código do documento</strong> e o{' '}
            <strong>Código verificador</strong>. O código de validação é opcional na digitação e
            será preenchido automaticamente após a conferência.
          </p>

          <div className="space-y-2">
            <Field label="Código do documento" hint="Ex.: DOC-2026-000001">
              <Input
                value={codigoDocumento}
                onChange={(event) => setCodigoDocumento(event.target.value.toUpperCase())}
                placeholder="DOC-AAAA-000000"
                autoComplete="off"
                className="mono"
              />
            </Field>
            <Field label="Código verificador" hint="Ex.: DCC00098A844">
              <Input
                value={verificador}
                onChange={(event) => setVerificador(event.target.value.toUpperCase())}
                placeholder="12 caracteres"
                autoComplete="off"
                className="mono"
              />
            </Field>
            <Field
              label="Código de validação"
              hint="Opcional na digitação manual · preenchido pelo link/QR"
            >
              <Input
                value={codigoValidacao}
                onChange={(event) => setCodigoValidacao(event.target.value.toUpperCase())}
                placeholder="Preenchido automaticamente ou pelo link"
                autoComplete="off"
                className="mono text-[12px]"
              />
            </Field>
            <Button type="button" variant="filled" className="w-full" disabled={loading} onClick={() => consultar()}>
              {loading ? 'Validando...' : 'Validar documento'}
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

              <div className="space-y-1 rounded-[12px] border border-[var(--line)] bg-[var(--canvas-2)] p-3 text-[12px] text-[var(--ink-2)]">
                <p>
                  <strong>Código do documento:</strong>{' '}
                  <span className="mono">{data.codigo}</span>
                </p>
                <p>
                  <strong>Código verificador:</strong>{' '}
                  <span className="mono">{data.codigoVerificador}</span>
                </p>
                <p>
                  <strong>Código de validação:</strong>{' '}
                  <span className="mono break-all">{data.codigoValidacao}</span>
                </p>
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
                {data.vistoriaLabel ? (
                  <p>
                    <strong>Vistoria:</strong> {data.vistoriaLabel}
                  </p>
                ) : null}
                <p className="text-[12px] text-[var(--ink-3)]">
                  Criado em {new Date(data.criadoEm).toLocaleString('pt-BR')}
                </p>
                <p className="text-[12px] text-[var(--ink-3)]">
                  PDF original: {data.possuiPdfOriginal ? 'sim' : 'não'} · PDF assinado vigente:{' '}
                  {data.possuiPdfAssinado ? 'sim' : 'não'}
                </p>
                {!data.possuiPdfAssinado ? (
                  <p className="text-[12px] text-[var(--ink-3)]">
                    Este resultado refere-se ao documento sem assinatura externa vigente
                    {data.possuiPdfOriginal ? ' (há PDF original)' : ''}.
                  </p>
                ) : null}
              </div>

              <div>
                <p className="mb-2 text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">
                  Assinaturas vigentes
                </p>
                {data.assinaturas.length ? (
                  <ul className="space-y-2 text-[12px]">
                    {data.assinaturas.map((item, index) => (
                      <li
                        key={`${item.assinanteNome}-${index}`}
                        className="rounded-[10px] border border-[var(--line)] p-2"
                      >
                        <p className="font-semibold text-[var(--ink)]">{item.assinanteNome}</p>
                        <p className="text-[var(--ink-3)]">
                          {item.qualificacao ?? '—'} · CPF{' '}
                          {item.cpfNaoInformado
                            ? 'não informado'
                            : item.assinanteDocumento ?? '***'}{' '}
                          · E-mail{' '}
                          {item.emailNaoInformado
                            ? 'não informado'
                            : item.assinanteEmail ?? '***'}
                        </p>
                        <p className="text-[var(--ink-3)]">
                          {new Date(item.coletadaEm).toLocaleString('pt-BR')}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[12px] text-[var(--ink-3)]">Nenhuma assinatura externa vigente</p>
                )}
              </div>
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
