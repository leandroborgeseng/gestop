'use client';

import { FormEvent, useEffect, useState } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import {
  Building2,
  Camera,
  CheckCircle2,
  Droplets,
  Lightbulb,
  MapPin,
  Megaphone,
  Shield,
  Sparkles,
  X,
} from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { LoadingState } from '@/components/ui-states';
import { createPublicChamado, getPublicUnidade } from '@/lib/api';
import { ChamadoResumo, PublicUnidadeChamado } from '@/lib/types';

const CATEGORIAS = [
  { id: 'INFRA', label: 'Infraestrutura', icon: Building2 },
  { id: 'LIMPEZA', label: 'Limpeza', icon: Sparkles },
  { id: 'ILUMINACAO', label: 'Iluminação', icon: Lightbulb },
  { id: 'AGUA', label: 'Água/esgoto', icon: Droplets },
  { id: 'SEGURANCA', label: 'Segurança', icon: Shield },
] as const;

type CategoriaId = (typeof CATEGORIAS)[number]['id'];

export default function ChamadoPublicoPage() {
  const params = useParams<{ codigo: string }>();
  const codigo = decodeURIComponent(params.codigo ?? '');

  const [unidade, setUnidade] = useState<PublicUnidadeChamado | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chamado, setChamado] = useState<ChamadoResumo | null>(null);

  const [categoria, setCategoria] = useState<CategoriaId | null>(null);
  const [descricao, setDescricao] = useState('');
  const [solicitanteNome, setSolicitanteNome] = useState('');
  const [solicitanteEmail, setSolicitanteEmail] = useState('');
  const [solicitanteTelefone, setSolicitanteTelefone] = useState('');
  const [fotoDataUrl, setFotoDataUrl] = useState<string | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getPublicUnidade(codigo)
      .then(setUnidade)
      .catch((err) => setError(err instanceof Error ? err.message : 'QR Code inválido ou próprio inativo.'))
      .finally(() => setLoading(false));
  }, [codigo]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!categoria) {
      setError('Selecione uma categoria para o chamado.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const categoriaLabel = CATEGORIAS.find((item) => item.id === categoria)?.label ?? categoria;
    const descricaoCompleta = `[${categoriaLabel}] ${descricao.trim()}`;

    try {
      const created = await createPublicChamado(codigo, {
        descricao: descricaoCompleta,
        solicitanteNome: solicitanteNome || undefined,
        solicitanteEmail: solicitanteEmail || undefined,
        solicitanteTelefone: solicitanteTelefone || undefined,
        fotoDataUrl: fotoDataUrl ?? undefined,
      });
      setChamado(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao registrar chamado.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePhotoSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Selecione um arquivo de imagem (JPEG, PNG ou WebP).');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('A foto deve ter no máximo 8 MB.');
      return;
    }
    setError(null);
    const dataUrl = await readFileAsDataUrl(file);
    setFotoDataUrl(dataUrl);
    setFotoPreview(dataUrl);
  }

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
              <p className="text-[11px] opacity-90">Chamado via QR Code · GestOP</p>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="p-6">
            <LoadingState label="Carregando próprio público..." />
          </div>
        ) : null}

        {!loading && error && !unidade ? (
          <div className="p-6">
            <Alert variant="error">{error}</Alert>
          </div>
        ) : null}

        {!loading && unidade && !chamado ? (
          <>
            <div className="relative z-[2] mx-3.5 -mt-3 rounded-[14px] bg-[var(--surface)] p-3.5 shadow-[var(--sh-md)]">
              <p className="text-[10.5px] font-bold tracking-wide text-[var(--brand)] uppercase">{unidade.codigoPatrimonial}</p>
              <h1 className="mt-1 text-[16px] font-bold text-[var(--ink)]">{unidade.nome}</h1>
              <p className="mt-1 flex items-start gap-1.5 text-[12px] text-[var(--ink-3)]">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {unidade.endereco}
                {unidade.bairro ? ` · ${unidade.bairro}` : ''}
              </p>
              <p className="mt-1 text-[12px] text-[var(--ink-3)]">
                {unidade.secretaria.nome} ({unidade.secretaria.sigla})
              </p>
            </div>

            <form onSubmit={handleSubmit} className="px-3.5 pt-4 pb-5">
              <p className="mb-4 px-0.5 text-[13px] leading-snug text-[var(--ink-2)]">
                Descreva o problema encontrado neste próprio. A equipe da prefeitura receberá sua solicitação para triagem.
              </p>

              {error ? <Alert variant="error" className="mb-4">{error}</Alert> : null}

              <fieldset className="mb-4">
                <legend className="mb-2 block text-[12.5px] font-semibold text-[var(--ink-2)]">Categoria</legend>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIAS.map((item) => {
                    const Icon = item.icon;
                    const active = categoria === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setCategoria(item.id)}
                        className={cn(
                          'flex flex-col items-center gap-1.5 rounded-xl border-[1.5px] px-2 py-3 text-[12px] font-semibold transition-colors',
                          active
                            ? 'border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-hover)]'
                            : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] hover:bg-[var(--surface-2)]',
                        )}
                      >
                        <Icon className={cn('h-5 w-5', active ? 'text-[var(--brand)]' : 'text-[var(--brand)]')} />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <label className="mb-4 block">
                <span className="mb-1.5 block text-[12.5px] font-semibold text-[var(--ink-2)]">Descrição do problema</span>
                <textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  minLength={10}
                  rows={4}
                  required
                  placeholder="Ex.: Vazamento no banheiro do 2º andar..."
                  className="w-full resize-none rounded-[11px] border border-[var(--line)] bg-[var(--surface)] px-3 py-3 text-[14px] text-[var(--ink)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brand-soft)]"
                />
              </label>

              <div className="mb-4">
                <span className="mb-1.5 block text-[12.5px] font-semibold text-[var(--ink-2)]">
                  Foto do problema <span className="font-medium text-[var(--ink-3)]">(opcional)</span>
                </span>
                {fotoPreview ? (
                  <div className="relative overflow-hidden rounded-[11px] border border-[var(--line)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={fotoPreview} alt="Prévia da foto" className="max-h-48 w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        setFotoDataUrl(null);
                        setFotoPreview(null);
                      }}
                      className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--ink)]/70 text-white"
                      aria-label="Remover foto"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex h-[60px] w-full cursor-pointer items-center justify-center gap-2 rounded-[11px] border-[1.5px] border-dashed border-[var(--line)] bg-[var(--surface-2)] text-[13px] font-semibold text-[var(--brand)] hover:border-[var(--brand)] hover:bg-[var(--brand-soft)]">
                    <Camera className="h-4 w-4" />
                    Adicionar foto
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/heic"
                      capture="environment"
                      className="sr-only"
                      onChange={(event) => void handlePhotoSelect(event)}
                    />
                  </label>
                )}
              </div>

              <label className="mb-4 block">
                <span className="mb-1.5 block text-[12.5px] font-semibold text-[var(--ink-2)]">
                  Seu nome <span className="font-medium text-[var(--ink-3)]">(opcional)</span>
                </span>
                <input
                  value={solicitanteNome}
                  onChange={(e) => setSolicitanteNome(e.target.value)}
                  className="h-[46px] w-full rounded-[11px] border border-[var(--line)] bg-[var(--surface)] px-3 text-[14px] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brand-soft)]"
                />
              </label>

              <label className="mb-4 block">
                <span className="mb-1.5 block text-[12.5px] font-semibold text-[var(--ink-2)]">
                  E-mail <span className="font-medium text-[var(--ink-3)]">(opcional)</span>
                </span>
                <input
                  type="email"
                  value={solicitanteEmail}
                  onChange={(e) => setSolicitanteEmail(e.target.value)}
                  className="h-[46px] w-full rounded-[11px] border border-[var(--line)] bg-[var(--surface)] px-3 text-[14px] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brand-soft)]"
                />
              </label>

              <label className="mb-5 block">
                <span className="mb-1.5 block text-[12.5px] font-semibold text-[var(--ink-2)]">
                  Telefone <span className="font-medium text-[var(--ink-3)]">(opcional)</span>
                </span>
                <input
                  type="tel"
                  value={solicitanteTelefone}
                  onChange={(e) => setSolicitanteTelefone(e.target.value)}
                  className="h-[46px] w-full rounded-[11px] border border-[var(--line)] bg-[var(--surface)] px-3 text-[14px] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brand-soft)]"
                />
              </label>

              <Button
                type="submit"
                variant="filled"
                className="h-[50px] w-full gap-2 rounded-[13px] text-[14.5px] font-bold"
                disabled={submitting || !categoria}
              >
                <Megaphone className="h-4 w-4" />
                {submitting ? 'Enviando...' : 'Registrar chamado'}
              </Button>

              <p className="mt-3 flex gap-1.5 text-[11px] leading-snug text-[var(--ink-3)]">
                <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Dados de contato são opcionais e usados apenas para retorno sobre este chamado, conforme a LGPD.
              </p>
            </form>
          </>
        ) : null}

        {chamado ? (
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <span className="mb-4 flex h-[84px] w-[84px] items-center justify-center rounded-full bg-[var(--ok-bg)] text-[var(--ok)]">
              <CheckCircle2 className="h-10 w-10" strokeWidth={2} />
            </span>
            <h2 className="text-[21px] font-bold text-[var(--ink)]">Chamado registrado!</h2>
            <p className="mt-2 max-w-[280px] text-[13.5px] leading-snug text-[var(--ink-3)]">
              A equipe da {chamado.secretaria.sigla} irá analisar sua solicitação. Guarde o protocolo abaixo.
            </p>
            <p className="mono mt-4 rounded-[11px] bg-[var(--brand-soft)] px-4 py-2.5 text-[17px] font-semibold tracking-wide text-[var(--brand-hover)]">
              {chamado.codigo}
            </p>
          </div>
        ) : null}
      </div>

      <p className="mt-5 text-center text-[12px] text-[var(--ink-3)]">Prefeitura Municipal de Franca · GestOP</p>
    </main>
  );
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
