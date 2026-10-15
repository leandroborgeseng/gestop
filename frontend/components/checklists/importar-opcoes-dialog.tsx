'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { PendenciasPortal } from '@/components/pendencias/pendencias-acesso-dialog';
import { Button } from '@/components/ui/button';
import {
  analisarLinhasEmLotes,
  erroLimiteAoAdicionar,
  linhasModelo,
  MAX_OPCOES_MULTIPLA_ESCOLHA,
  type FinalidadeImportacao,
  type ModoImportacao,
  type OpcaoImportada,
  type ResultadoImportacao,
} from '@/lib/checklist-importar-opcoes';
import { baixarModeloOpcoes, EXTENSOES_ACEITAS, lerArquivoOpcoes, type ArquivoLido } from '@/lib/checklist-importar-opcoes-arquivo';

export const TEXTO_EXPLICACAO = 'Uma opção por linha. A primeira linha é o cabeçalho: Opção{, Nota}.';
export const TEXTO_FORMATOS = `Formatos aceitos: XLSX, XLS, CSV, TXT, até ${MAX_OPCOES_MULTIPLA_ESCOLHA} opções.`;
const PREVIA_INICIAL = 20;

type Estado = 'escolha' | 'previa' | 'conflito';

/** 294: um modal, três estados (escolha do arquivo, prévia, conflito com opções atuais). */
export function ImportarOpcoesDialog({
  open,
  finalidade,
  opcoesAtuais,
  onClose,
  onImportar,
}: {
  open: boolean;
  finalidade: FinalidadeImportacao;
  /** quantas opções preenchidas a pergunta já tem */
  opcoesAtuais: number;
  onClose: () => void;
  onImportar: (opcoes: OpcaoImportada[], modo: ModoImportacao) => void;
}) {
  const [estado, setEstado] = useState<Estado>('escolha');
  const [lendo, setLendo] = useState(false);
  const [arquivo, setArquivo] = useState<ArquivoLido | null>(null);
  const [aba, setAba] = useState(0);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [erroLeitura, setErroLeitura] = useState<string | null>(null);
  const [todas, setTodas] = useState(false);
  const [modo, setModo] = useState<ModoImportacao>('adicionar');
  const painelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setEstado('escolha');
    setArquivo(null);
    setResultado(null);
    setErroLeitura(null);
    setTodas(false);
    setModo('adicionar');
    setAba(0);
    window.setTimeout(() => painelRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus(), 0);
  }, [open]);

  async function analisarAba(lido: ArquivoLido, indice: number) {
    const alvo = lido.abas[indice];
    setResultado(
      await analisarLinhasEmLotes(alvo?.linhas ?? [], finalidade, {
        linhaInicial: alvo?.linhaInicial ?? 1,
        permitirSemCabecalho: lido.tipo === 'txt',
      }),
    );
  }

  async function escolher(file: File | undefined) {
    if (!file) return;
    setLendo(true);
    setErroLeitura(null);
    try {
      const lido = await lerArquivoOpcoes(file);
      setArquivo(lido);
      setAba(0);
      setTodas(false);
      await analisarAba(lido, 0);
      setEstado('previa');
    } catch (err) {
      setErroLeitura(err instanceof Error ? err.message : 'Não foi possível ler o arquivo.');
    } finally {
      setLendo(false);
    }
  }

  if (!open) return null;

  const validas = resultado?.opcoes.length ?? 0;
  const erros = resultado?.erros ?? [];
  const bloqueado = !resultado || erros.length > 0 || validas === 0;
  const erroAdicionar = estado === 'conflito' && modo === 'adicionar' ? erroLimiteAoAdicionar(opcoesAtuais, validas) : null;
  const visiveis = resultado ? (todas ? resultado.opcoes : resultado.opcoes.slice(0, PREVIA_INICIAL)) : [];

  function confirmar() {
    if (bloqueado || !resultado) return;
    if (estado === 'previa' && opcoesAtuais > 0) {
      setEstado('conflito');
      return;
    }
    if (erroAdicionar) return;
    onImportar(resultado.opcoes, opcoesAtuais > 0 ? modo : 'substituir');
  }

  function teclado(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape' && !lendo) {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !painelRef.current) return;
    const focaveis = [...painelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')];
    if (!focaveis.length) return;
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];
    if (e.shiftKey && document.activeElement === primeiro) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primeiro.focus();
    }
  }

  return (
    <PendenciasPortal>
      <div className="fixed inset-0 z-[150] flex items-stretch justify-center bg-black/45 sm:items-center sm:p-4" role="presentation">
        <div
          ref={painelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="importar-opcoes-titulo"
          onKeyDown={teclado}
          data-testid="importar-opcoes-dialog"
          className="flex h-[100dvh] w-full flex-col bg-[var(--surface)] sm:h-auto sm:max-h-[90vh] sm:max-w-[640px] sm:rounded-[16px]"
        >
          <header className="shrink-0 border-b border-[var(--line)] px-4 py-3">
            <h2 id="importar-opcoes-titulo" className="text-[16px] font-semibold text-[var(--ink)]">
              Importar lista de opções
            </h2>
          </header>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 text-[13px] text-[var(--ink-2)]" data-testid="importar-opcoes-corpo">
            <p aria-live="polite" data-testid="importar-opcoes-status" className="text-[12px] text-[var(--ink-3)]">
              {lendo ? 'Lendo arquivo…' : ''}
            </p>
            {estado === 'escolha' ? (
              <div data-estado="escolha" className="space-y-2">
                <p>{TEXTO_EXPLICACAO}</p>
                <p className="text-[12px] text-[var(--ink-3)]">{TEXTO_FORMATOS}</p>
                <div
                  className="flex flex-col items-start gap-2 rounded-[12px] border border-dashed border-[var(--line)] p-4"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    void escolher(e.dataTransfer.files?.[0]);
                  }}
                >
                  <input
                    ref={inputRef}
                    type="file"
                    accept={EXTENSOES_ACEITAS}
                    className="sr-only"
                    data-testid="importar-opcoes-arquivo"
                    aria-label="Arquivo de opções"
                    disabled={lendo}
                    onChange={(e) => {
                      void escolher(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                  <Button type="button" variant="outlined" size="sm" className="min-h-11 sm:min-h-8" data-autofocus disabled={lendo} onClick={() => inputRef.current?.click()}>
                    Selecionar arquivo
                  </Button>
                  <button
                    type="button"
                    className="min-h-11 text-[12px] font-semibold text-[var(--brand)] underline sm:min-h-0"
                    onClick={() => void baixarModeloOpcoes(linhasModelo(finalidade), finalidade === 'VISTORIA' ? 'modelo-opcoes-vistoria.xlsx' : 'modelo-opcoes.xlsx')}
                  >
                    Baixar modelo
                  </button>
                </div>
                {erroLeitura ? (
                  <p role="alert" className="text-[12px] text-[var(--danger)]">
                    {erroLeitura}
                  </p>
                ) : null}
              </div>
            ) : null}

            {estado === 'previa' && resultado ? (
              <div data-estado="previa" className="space-y-2">
                {arquivo && arquivo.abas.length > 1 ? (
                  <label className="block text-[12px] font-medium text-[var(--ink-2)]">
                    Aba
                    <select
                      data-testid="importar-opcoes-aba"
                      value={aba}
                      onChange={(e) => {
                        const i = Number(e.target.value);
                        setAba(i);
                        setTodas(false);
                        void analisarAba(arquivo, i);
                      }}
                      className="mt-1 block h-11 w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-2 sm:h-9"
                    >
                      {arquivo.abas.map((a, i) => (
                        <option key={a.nome} value={i}>
                          {a.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <p data-testid="importar-opcoes-resumo" className="font-semibold text-[var(--ink)]">
                  {[
                    `${validas} ${validas === 1 ? 'opção válida' : 'opções válidas'}`,
                    erros.filter((e) => e.linha != null).length ? `${erros.filter((e) => e.linha != null).length} linhas com erro` : null,
                    resultado.vazias ? `${resultado.vazias} vazias ignoradas` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {erros.length ? (
                  <ul data-testid="importar-opcoes-erros" role="alert" className="space-y-0.5 rounded-[10px] border border-[var(--danger-bd,#f2c9c9)] bg-[var(--danger-bg)] p-2 text-[12px] text-[var(--danger)]">
                    {erros.map((e, i) => (
                      <li key={i}>{e.mensagem}</li>
                    ))}
                  </ul>
                ) : null}
                {resultado.avisos.map((a) => (
                  <p key={a} data-testid="importar-opcoes-aviso" className="rounded-[10px] border border-amber-200 bg-amber-50 p-2 text-[12px] text-[var(--warn-ink,#7a4b00)]">
                    {a}
                  </p>
                ))}
                <ol data-testid="importar-opcoes-lista" className="list-decimal space-y-0.5 pl-6">
                  {visiveis.map((o) => (
                    <li key={`${o.linha}-${o.nome}`}>
                      {o.nome}
                      {o.nota != null ? <span className="text-[var(--ink-3)]"> · nota {o.nota}</span> : null}
                    </li>
                  ))}
                </ol>
                {!todas && validas > PREVIA_INICIAL ? (
                  <button type="button" className="min-h-11 text-[12px] font-semibold text-[var(--brand)] underline sm:min-h-0" onClick={() => setTodas(true)}>
                    Mostrar todas
                  </button>
                ) : null}
              </div>
            ) : null}

            {estado === 'conflito' ? (
              <fieldset data-estado="conflito" className="space-y-2">
                <legend className="mb-1 font-semibold text-[var(--ink)]">A pergunta já tem {opcoesAtuais} opções.</legend>
                <label className="flex min-h-11 items-center gap-2">
                  <input type="radio" name="modo-importacao" value="adicionar" checked={modo === 'adicionar'} onChange={() => setModo('adicionar')} data-autofocus />
                  Adicionar ao final (mantém as {opcoesAtuais} atuais)
                </label>
                <label className="flex min-h-11 items-start gap-2">
                  <input type="radio" name="modo-importacao" value="substituir" checked={modo === 'substituir'} onChange={() => setModo('substituir')} className="mt-1" />
                  <span>
                    Substituir as {opcoesAtuais} opções atuais
                    <span className="block text-[12px] text-[var(--danger)]">As opções atuais desta pergunta serão trocadas pelas do arquivo.</span>
                  </span>
                </label>
                {erroAdicionar ? (
                  <p role="alert" className="text-[12px] text-[var(--danger)]">
                    {erroAdicionar}
                  </p>
                ) : null}
              </fieldset>
            ) : null}
          </div>

          <footer className="shrink-0 border-t border-[var(--line)] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {estado !== 'escolha' && bloqueado ? (
              <p className="mb-2 text-[12px] text-[var(--ink-3)]">Corrija o arquivo e selecione de novo.</p>
            ) : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outlined" size="sm" className="min-h-11 sm:min-h-8" disabled={lendo} onClick={onClose}>
                Cancelar
              </Button>
              {estado !== 'escolha' ? (
                <Button
                  type="button"
                  variant="filled"
                  size="sm"
                  className="min-h-11 sm:min-h-8"
                  data-testid="importar-opcoes-confirmar"
                  disabled={bloqueado || Boolean(erroAdicionar)}
                  onClick={confirmar}
                >
                  {`Importar ${validas} ${validas === 1 ? 'opção' : 'opções'}`}
                </Button>
              ) : null}
            </div>
          </footer>
        </div>
      </div>
    </PendenciasPortal>
  );
}
