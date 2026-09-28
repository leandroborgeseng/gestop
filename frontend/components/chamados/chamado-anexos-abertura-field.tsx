'use client';

import { Camera, FileUp, X } from 'lucide-react';
import {
  ANEXOS_ABERTURA_ACCEPT,
  ANEXOS_ABERTURA_IMAGEM_ACCEPT,
  AnexoAberturaDraft,
  categoriaDoMime,
  lerArquivoComoDataUrl,
  mensagemArquivoAbertura,
  mimeDeArquivo,
} from '@/lib/chamado-anexos-abertura';

export function ChamadoAnexosAberturaField({
  value,
  onChange,
  disabled,
  onError,
  onImageAdded,
}: {
  value: AnexoAberturaDraft[];
  onChange: (next: AnexoAberturaDraft[]) => void;
  disabled?: boolean;
  onError?: (message: string | null) => void;
  onImageAdded?: () => void;
}) {
  async function adicionar(files: FileList | null) {
    if (!files?.length) return;
    const proximos = [...value];
    let erro: string | null = null;
    let adicionouImagem = false;

    for (const file of Array.from(files)) {
      const mensagem = mensagemArquivoAbertura(file, proximos);
      if (mensagem) {
        erro = mensagem;
        continue;
      }
      const mimeType = mimeDeArquivo(file);
      if (!mimeType) {
        erro = 'Formato não permitido. Use JPG, JPEG, PNG, WEBP ou PDF.';
        continue;
      }
      try {
        const dataUrl = await lerArquivoComoDataUrl(file);
        proximos.push({
          id: `${file.name}-${file.size}-${proximos.length}-${Date.now()}`,
          nome: file.name,
          mimeType,
          dataUrl,
          categoria: categoriaDoMime(mimeType),
        });
        if (categoriaDoMime(mimeType) === 'imagem') adicionouImagem = true;
      } catch (error) {
        erro = error instanceof Error ? error.message : 'Não foi possível ler o arquivo.';
      }
    }

    onChange(proximos);
    onError?.(erro);
    if (adicionouImagem) onImageAdded?.();
  }

  return (
    <div>
      <p className="text-[13px] font-semibold text-[var(--ink)]">Fotos e documentos anexados na abertura (opcional)</p>
      <p className="mt-1 text-[12px] text-[var(--ink-3)]">Formatos permitidos: JPG, JPEG, PNG, WEBP e PDF.</p>
      <p className="text-[12px] text-[var(--ink-3)]">Até 8 arquivos, 8 MB cada, somando no máximo 20 MB.</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-[var(--r-md)] border border-dashed border-[var(--line)] px-3 py-2.5 text-[13px] font-semibold text-[var(--brand)] hover:bg-[var(--surface-2)]">
          <Camera className="h-4 w-4" />
          Tirar foto
          <input
            type="file"
            accept={ANEXOS_ABERTURA_IMAGEM_ACCEPT}
            capture="environment"
            className="sr-only"
            disabled={disabled}
            onChange={(event) => {
              void adicionar(event.target.files);
              event.target.value = '';
            }}
          />
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-[var(--r-md)] border border-dashed border-[var(--line)] px-3 py-2.5 text-[13px] font-semibold text-[var(--brand)] hover:bg-[var(--surface-2)]">
          <FileUp className="h-4 w-4" />
          Escolher arquivos
          <input
            type="file"
            accept={ANEXOS_ABERTURA_ACCEPT}
            multiple
            className="sr-only"
            disabled={disabled}
            onChange={(event) => {
              void adicionar(event.target.files);
              event.target.value = '';
            }}
          />
        </label>
      </div>
      {value.length ? (
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {value.map((anexo) => (
            <li key={anexo.id} className="relative overflow-hidden rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)]">
              {anexo.categoria === 'imagem' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={anexo.dataUrl} alt={anexo.nome} className="h-24 w-full object-cover" />
              ) : (
                <div className="flex h-24 items-center px-2 text-[12px] font-semibold text-[var(--ink)]">
                  <span className="line-clamp-3">{anexo.nome}</span>
                </div>
              )}
              <button
                type="button"
                className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 text-white"
                aria-label={`Remover ${anexo.nome}`}
                onClick={() => onChange(value.filter((item) => item.id !== anexo.id))}
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <p className="truncate px-2 py-1 text-[11px] text-[var(--ink-3)]">{anexo.nome}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
