'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, FileText, X } from 'lucide-react';
import { AuthenticatedImage } from '@/components/ui/authenticated-image';
import { Button } from '@/components/ui/button';
import { baixarStorageAutenticado } from '@/lib/storage-url';
import { cn } from '@/lib/cn';

export type ChamadoAnexoAberturaView = {
  id: string;
  nome: string;
  mimeType?: string | null;
  categoria: 'imagem' | 'pdf' | 'video';
  url: string;
};

export function ChamadoAnexosAberturaView({
  anexos,
  fotoUrl,
}: {
  anexos?: ChamadoAnexoAberturaView[] | null;
  fotoUrl?: string | null;
}) {
  const imagensInformadas = (anexos ?? []).filter((item) => item.categoria === 'imagem' && item.url);
  const imagens =
    imagensInformadas.length > 0
      ? imagensInformadas
      : fotoUrl
        ? [{ id: 'foto-abertura', nome: 'Foto da abertura', categoria: 'imagem' as const, url: fotoUrl }]
        : [];
  const pdfs = (anexos ?? []).filter((item) => item.categoria === 'pdf' && item.url);
  const videos = (anexos ?? []).filter((item) => item.categoria === 'video' && item.url);
  const [aberta, setAberta] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (aberta == null) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setAberta(null);
      if (event.key === 'ArrowRight') setAberta((atual) => (atual == null ? atual : (atual + 1) % imagens.length));
      if (event.key === 'ArrowLeft') {
        setAberta((atual) => (atual == null ? atual : (atual - 1 + imagens.length) % imagens.length));
      }
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [aberta, imagens.length]);

  if (!imagens.length && !pdfs.length && !videos.length) return null;

  const umaImagem = imagens.length === 1;
  const duasImagens = imagens.length === 2;

  async function abrirPdf(url: string, nome: string) {
    await baixarStorageAutenticado(url, nome);
  }

  return (
    <div>
      <p className="text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">Documentos anexados na abertura</p>
      {imagens.length ? (
        <div
          className={cn(
            'mt-2 grid gap-2',
            umaImagem && 'grid-cols-1',
            duasImagens && 'grid-cols-2',
            imagens.length >= 3 && 'grid-cols-2 sm:grid-cols-3',
          )}
        >
          {imagens.map((imagem, index) => (
            <button
              key={imagem.id}
              type="button"
              onClick={() => setAberta(index)}
              className="group relative overflow-hidden rounded-[var(--r-md)] border border-[var(--line)] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
              aria-label={`Ampliar ${imagem.nome}`}
            >
              <AuthenticatedImage
                src={imagem.url}
                alt={imagem.nome}
                className={cn(
                  'w-full object-cover',
                  umaImagem ? 'max-h-56' : 'h-28 sm:h-32',
                )}
              />
            </button>
          ))}
        </div>
      ) : null}
      {videos.length ? (
        <ul className="mt-3 space-y-2">
          {videos.map((video) => (
            <li key={video.id}>
              <button
                type="button"
                onClick={() => void abrirPdf(video.url, video.nome)}
                className="flex w-full items-center gap-2 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-left text-[13px] font-semibold text-[var(--ink)] hover:border-[var(--brand)]"
              >
                <span className="min-w-0 flex-1 truncate">{video.nome}</span>
                <span className="text-[11px] font-semibold text-[var(--brand)]">Abrir</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {pdfs.length ? (
        <ul className="mt-3 space-y-2">
          {pdfs.map((pdf) => (
            <li key={pdf.id}>
              <button
                type="button"
                onClick={() => void abrirPdf(pdf.url, pdf.nome)}
                className="flex w-full items-center gap-2 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-left text-[13px] font-semibold text-[var(--ink)] hover:border-[var(--brand)]"
              >
                <FileText className="h-4 w-4 shrink-0 text-[var(--brand)]" />
                <span className="min-w-0 flex-1 truncate">{pdf.nome}</span>
                <span className="text-[11px] font-semibold text-[var(--brand)]">Abrir</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {aberta != null && mounted && imagens[aberta]
        ? createPortal(
            <div
              className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 p-4"
              role="dialog"
              aria-modal="true"
              aria-label={imagens[aberta].nome}
              onClick={() => setAberta(null)}
            >
              <button
                type="button"
                className="absolute top-4 right-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white"
                aria-label="Fechar visualização"
                onClick={() => setAberta(null)}
              >
                <X className="h-5 w-5" />
              </button>
              {imagens.length > 1 ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    className="absolute top-1/2 left-3 -translate-y-1/2 text-white"
                    aria-label="Imagem anterior"
                    onClick={(event) => {
                      event.stopPropagation();
                      setAberta((atual) => (atual == null ? atual : (atual - 1 + imagens.length) % imagens.length));
                    }}
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-white"
                    aria-label="Próxima imagem"
                    onClick={(event) => {
                      event.stopPropagation();
                      setAberta((atual) => (atual == null ? atual : (atual + 1) % imagens.length));
                    }}
                  >
                    <ChevronRight className="h-6 w-6" />
                  </Button>
                </>
              ) : null}
              <div className="max-h-[min(92dvh,calc(100dvh-5rem))] max-w-[min(96vw,1100px)]" onClick={(event) => event.stopPropagation()}>
                <AuthenticatedImage
                  src={imagens[aberta].url}
                  alt={imagens[aberta].nome}
                  className="max-h-[min(92dvh,calc(100dvh-5rem))] w-full object-contain"
                />
                <p className="mt-2 text-center text-[12px] text-white/80">
                  {imagens[aberta].nome}
                  {imagens.length > 1 ? ` · ${aberta + 1} de ${imagens.length}` : ''}
                </p>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
