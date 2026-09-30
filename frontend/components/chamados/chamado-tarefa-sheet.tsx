'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Sheet } from '@/components/ui/sheet';
import { useSnackbar } from '@/components/ui/snackbar';
import { anexarChamadoTarefa, getChamadoTarefa, updateChamadoTarefa } from '@/lib/api';
import { TAREFA_PRIORIDADE_LABEL, TAREFA_STATUS_LABEL, type ChamadoTarefaDetalhe, type ChamadoTarefaStatus } from '@/lib/chamado-tarefa';

export function ChamadoTarefaSheet({
  tarefaId,
  onClose,
  onChanged,
}: {
  tarefaId: string | null;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const snackbar = useSnackbar();
  const [tarefa, setTarefa] = useState<ChamadoTarefaDetalhe | null>(null);
  const [busy, setBusy] = useState(false);
  const [justificativa, setJustificativa] = useState('');
  const [conclusao, setConclusao] = useState('');
  const [observacao, setObservacao] = useState('');

  useEffect(() => {
    if (!tarefaId) {
      setTarefa(null);
      return;
    }
    let ativo = true;
    getChamadoTarefa(tarefaId)
      .then((data) => {
        if (!ativo) return;
        setTarefa(data);
        setObservacao(data.observacao ?? '');
      })
      .catch((err) => snackbar.show(err instanceof Error ? err.message : 'Falha ao abrir a tarefa.', 'error'));
    return () => {
      ativo = false;
    };
    // snackbar muda de identidade; a carga segue só o id da tarefa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarefaId]);

  async function salvarStatus(status: ChamadoTarefaStatus) {
    if (!tarefa) return;
    setBusy(true);
    try {
      await updateChamadoTarefa(tarefa.id, {
        status,
        justificativa: justificativa.trim() || undefined,
        conclusaoTexto: conclusao.trim() || undefined,
        observacao: observacao.trim() || undefined,
      });
      const atualizada = await getChamadoTarefa(tarefa.id);
      setTarefa(atualizada);
      setJustificativa('');
      setConclusao('');
      snackbar.show('Tarefa atualizada.', 'success');
      onChanged?.();
    } catch (err) {
      snackbar.show(err instanceof Error ? err.message : 'Falha ao atualizar a tarefa.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function anexar(file: File) {
    if (!tarefa) return;
    const dataUrl = await readFile(file);
    setBusy(true);
    try {
      const atualizada = await anexarChamadoTarefa(tarefa.id, { dataUrl, nome: file.name });
      setTarefa(atualizada);
      snackbar.show('Evidência anexada à tarefa.', 'success');
      onChanged?.();
    } catch (err) {
      snackbar.show(err instanceof Error ? err.message : 'Falha ao anexar.', 'error');
    } finally {
      setBusy(false);
    }
  }

  const encerrada = tarefa?.status === 'CONCLUIDA' || tarefa?.status === 'CANCELADA';

  return (
    <Sheet open={Boolean(tarefaId)} onClose={onClose} title="Executar tarefa" className="max-w-xl">
      {!tarefa ? (
        <p className="text-[13px] text-[var(--ink-3)]">Carregando tarefa…</p>
      ) : (
        <div className="space-y-3 text-[13px]">
          <p className="mono text-[12px] font-semibold text-[var(--brand-hover)]">{tarefa.chamado.codigo}</p>
          <h3 className="text-[16px] font-semibold text-[var(--ink)]">{tarefa.titulo}</h3>
          <p className="text-[var(--ink-3)]">
            {TAREFA_STATUS_LABEL[tarefa.status]} · {TAREFA_PRIORIDADE_LABEL[tarefa.prioridade] ?? tarefa.prioridade}
            {tarefa.atrasada ? ' · Atrasada' : ''}
          </p>
          {tarefa.descricao ? <p className="text-[var(--ink-2)]">{tarefa.descricao}</p> : null}
          <p className="text-[var(--ink-3)]">
            Chamado: {tarefa.chamado.titulo || tarefa.chamado.descricao.slice(0, 120)}
            {tarefa.chamado.unidade ? ` · ${tarefa.chamado.unidade.nome}` : ''}
          </p>
          <p className="text-[var(--ink-3)]">
            {[tarefa.secretaria?.sigla, tarefa.equipe?.nome, tarefa.responsavel?.nome, tarefa.prazo ? new Date(tarefa.prazo).toLocaleString('pt-BR') : 'Sem prazo']
              .filter(Boolean)
              .join(' · ')}
          </p>
          {tarefa.justificativa ? <p className="rounded-[10px] bg-amber-50 p-2 text-amber-900">Justificativa: {tarefa.justificativa}</p> : null}
          {tarefa.conclusaoTexto ? <p className="rounded-[10px] bg-emerald-50 p-2">Conclusão: {tarefa.conclusaoTexto}</p> : null}

          {tarefa.podeTratar && !encerrada ? (
            <div className="space-y-2 border-t border-[var(--line)] pt-3">
              <Field label="Observações">
                <textarea value={observacao} onChange={(event) => setObservacao(event.target.value)} className="min-h-16 w-full rounded-[10px] border border-[var(--line)] p-2" />
              </Field>
              <Field label="Justificativa">
                <textarea value={justificativa} onChange={(event) => setJustificativa(event.target.value)} className="min-h-16 w-full rounded-[10px] border border-[var(--line)] p-2" />
              </Field>
              <Field label="Texto de conclusão">
                <textarea value={conclusao} onChange={(event) => setConclusao(event.target.value)} className="min-h-16 w-full rounded-[10px] border border-[var(--line)] p-2" />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outlined" disabled={busy} onClick={() => void salvarStatus('VISUALIZADA')}>
                  Marcar visualizada
                </Button>
                <Button type="button" size="sm" variant="outlined" disabled={busy} onClick={() => void salvarStatus('EM_ANDAMENTO')}>
                  Registrar andamento
                </Button>
                <Button type="button" size="sm" variant="outlined" disabled={busy} onClick={() => void salvarStatus('IMPEDIDA')}>
                  Impedir tarefa
                </Button>
                <Button type="button" size="sm" variant="filled" disabled={busy} onClick={() => void salvarStatus('CONCLUIDA')}>
                  Concluir tarefa
                </Button>
                <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void salvarStatus('CANCELADA')}>
                  Cancelar tarefa
                </Button>
              </div>
              <Field label="Anexar evidências">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                  disabled={busy}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (file) void anexar(file);
                  }}
                />
              </Field>
            </div>
          ) : null}

          {tarefa.anexos.length ? (
            <ul className="space-y-1">
              {tarefa.anexos.map((anexo) => (
                <li key={anexo.id}>
                  <a href={anexo.url} target="_blank" rel="noreferrer" className="text-[var(--brand)] underline">
                    {anexo.nome}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}

          {tarefa.historico.length ? (
            <ol className="space-y-1 border-t border-[var(--line)] pt-3">
              {tarefa.historico.map((item) => (
                <li key={item.id} className="text-[12px] text-[var(--ink-3)]">
                  <span className="font-medium text-[var(--ink)]">{item.motivo}</span>
                  {' · '}
                  {new Date(item.createdAt).toLocaleString('pt-BR')}
                  {item.alteradoPor ? ` · ${item.alteradoPor.nome}` : ''}
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      )}
    </Sheet>
  );
}

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
    reader.readAsDataURL(file);
  });
}
