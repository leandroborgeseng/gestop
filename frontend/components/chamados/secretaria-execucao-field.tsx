'use client';

/**
 * 310 — campo "Secretaria responsável pela execução": lista todas as Secretarias ativas (independe do contexto)
 * para quem pode alterar; erro dentro do campo; após salvar, mostra origem → destino e o que revisar.
 */
import { useEffect, useState } from 'react';
import { AlertTriangle, Pencil } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { getSecretariasDestinoExecucao, updateChamadoAbertura, type TransferenciaExecucao } from '@/lib/api';
import { formatSecretariaLabel } from '@/lib/format-secretaria';
import { AVISO_PROPRIO_MANTIDO, avisosRevisao, mensagemTransferencia } from '@/lib/secretaria-execucao';
import type { SecretariaOption } from '@/lib/types';

export function SecretariaExecucaoField({
  chamadoId,
  secretaria,
  canEdit,
  busy,
  onSaved,
  onTransferido,
  onPerdeuAcesso,
}: {
  chamadoId: string;
  secretaria: SecretariaOption;
  canEdit: boolean;
  busy?: boolean;
  onSaved: () => void;
  /** Mensagem para fora do campo (ex.: snackbar) quando o chamado sai da Secretaria ativa. */
  onTransferido?: (t: TransferenciaExecucao, mensagem: string) => void;
  /** 310 (TL #48): sem acesso após a troca → quem usa fecha o detalhe e atualiza a lista (sem recarregar o detalhe). */
  onPerdeuAcesso?: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [opcoes, setOpcoes] = useState<SecretariaOption[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [draft, setDraft] = useState(secretaria.id);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<TransferenciaExecucao | null>(null);

  useEffect(() => setDraft(secretaria.id), [secretaria.id]);

  useEffect(() => {
    if (!editando) return;
    let vivo = true;
    setCarregando(true);
    setErro(null);
    getSecretariasDestinoExecucao()
      .then((rows) => vivo && setOpcoes(rows))
      .catch(() => vivo && setErro('Não foi possível carregar as Secretarias. Tente novamente.'))
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [editando]);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      const r = await updateChamadoAbertura(chamadoId, { secretariaId: draft });
      setEditando(false);
      const t = r.transferenciaExecucao ?? null;
      setResultado(t);
      if (t) onTransferido?.(t, mensagemTransferencia(t));
      if (t?.saiuDoEscopo && onPerdeuAcesso) onPerdeuAcesso();
      else onSaved();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível salvar a Secretaria de execução.');
    } finally {
      setSalvando(false);
    }
  }

  const lista = opcoes.some((o) => o.id === secretaria.id) || !opcoes.length ? opcoes : [secretaria, ...opcoes];
  const avisos = resultado ? avisosRevisao(resultado) : [];

  return (
    <div data-testid="secretaria-execucao-field">
      <div className="mb-1 flex items-center gap-1.5">
        <p id={`sec-exec-${chamadoId}`} className="text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">
          Secretaria responsável pela execução
        </p>
        {canEdit ? (
          <button
            type="button"
            onClick={() => {
              setEditando((v) => !v);
              setDraft(secretaria.id);
              setErro(null);
            }}
            className="text-[var(--brand)]"
            aria-label="Editar Secretaria responsável pela execução"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      {editando ? (
        <div className="space-y-2">
          <Select
            aria-labelledby={`sec-exec-${chamadoId}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={salvando || busy || carregando}
          >
            {(lista.length ? lista : [secretaria]).map((item) => (
              <option key={item.id} value={item.id}>
                {formatSecretariaLabel(item)}
              </option>
            ))}
          </Select>
          <p className="text-[11px] text-[var(--ink-3)]">{AVISO_PROPRIO_MANTIDO}</p>
          {erro ? (
            <div data-testid="secretaria-execucao-erro">
              <Alert variant="error">{erro}</Alert>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outlined" disabled={salvando || busy || carregando || !draft || draft === secretaria.id} onClick={() => void salvar()}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </Button>
            <Button size="sm" variant="text" disabled={salvando} onClick={() => setEditando(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-[13px] text-[var(--ink-2)]">{formatSecretariaLabel(secretaria)}</p>
      )}
      {resultado && !editando ? (
        <div role="status" data-testid="secretaria-execucao-resultado" className="mt-2 space-y-1 rounded-[var(--r-md)] bg-[var(--surface-2)] px-3 py-2 text-[12.5px]">
          <p className="font-semibold text-[var(--ink-2)]">{mensagemTransferencia(resultado)}</p>
          {avisos.map((a) => (
            <p key={a} data-testid="secretaria-execucao-revisar" className="flex items-start gap-1.5 font-medium text-[var(--warn,#b45309)]">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {a}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
