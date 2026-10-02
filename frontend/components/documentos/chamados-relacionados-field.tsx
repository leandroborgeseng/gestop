'use client';

import { FormEvent, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { buscarChamadosParaDocumento } from '@/lib/api';

export type ChamadoRelacionadoChip = {
  id: string;
  codigo: string;
  titulo?: string | null;
};

type Resultado = ChamadoRelacionadoChip & {
  tipo?: string | null;
  endereco?: string | null;
  unidade?: string | null;
  descricao?: string | null;
};

export function ChamadosRelacionadosField({
  value,
  onChange,
  disabled = false,
}: {
  value: ChamadoRelacionadoChip[];
  onChange: (next: ChamadoRelacionadoChip[]) => void;
  disabled?: boolean;
}) {
  const [termo, setTermo] = useState('');
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultados, setResultados] = useState<Resultado[]>([]);

  async function pesquisar(event?: FormEvent) {
    event?.preventDefault();
    const q = termo.trim();
    if (q.length < 2) {
      setErro('Digite ao menos 2 caracteres e pesquise.');
      setResultados([]);
      return;
    }
    setBusy(true);
    setErro(null);
    try {
      const resposta = await buscarChamadosParaDocumento(q);
      setResultados(resposta.items);
      if (!resposta.items.length) setErro('Nenhum chamado encontrado no seu acesso.');
    } catch (err) {
      setResultados([]);
      setErro(err instanceof Error ? err.message : 'Falha ao buscar chamados.');
    } finally {
      setBusy(false);
    }
  }

  function adicionar(item: Resultado) {
    if (value.some((atual) => atual.id === item.id)) return;
    onChange([...value, { id: item.id, codigo: item.codigo, titulo: item.titulo }]);
  }

  return (
    <div className="space-y-2">
      <Field label="Chamado(s) relacionado(s)">
        <form className="flex gap-2" onSubmit={(event) => void pesquisar(event)}>
          <Input
            value={termo}
            disabled={disabled || busy}
            onChange={(event) => setTermo(event.target.value)}
            placeholder="Número, título, tipo, endereço, próprio ou descrição"
          />
          <Button type="submit" variant="outlined" disabled={disabled || busy} aria-label="Pesquisar chamados">
            <Search className="h-4 w-4" />
          </Button>
        </form>
      </Field>
      <p className="text-[12px] text-[var(--ink-3)]">Opcional. A busca só ocorre ao pesquisar ou pressionar Enter.</p>
      {erro ? <p className="text-[12px] text-[var(--danger)]">{erro}</p> : null}
      {resultados.length ? (
        <ul className="max-h-40 space-y-1 overflow-y-auto rounded-[10px] border border-[var(--line)] p-1">
          {resultados.map((item) => {
            const ja = value.some((atual) => atual.id === item.id);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={disabled || ja}
                  onClick={() => adicionar(item)}
                  className="w-full rounded-[8px] px-2 py-1.5 text-left text-[12px] hover:bg-[var(--canvas-2)] disabled:opacity-60"
                >
                  <span className="font-semibold text-[var(--ink)]">{item.codigo}</span>
                  {item.titulo ? ` · ${item.titulo}` : ''}
                  <span className="block text-[var(--ink-3)]">
                    {[item.tipo, item.unidade, item.endereco].filter(Boolean).join(' · ') || 'Sem complemento'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {value.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((item) => (
            <li key={item.id} className="inline-flex max-w-full items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--canvas-2)] px-2 py-1 text-[12px]">
              <span className="truncate">
                <strong>{item.codigo}</strong>
                {item.titulo ? ` · ${item.titulo}` : ''}
              </span>
              {disabled ? null : (
                <button type="button" aria-label={`Remover ${item.codigo}`} onClick={() => onChange(value.filter((atual) => atual.id !== item.id))}>
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12px] text-[var(--ink-3)]">Nenhum chamado selecionado.</p>
      )}
    </div>
  );
}
