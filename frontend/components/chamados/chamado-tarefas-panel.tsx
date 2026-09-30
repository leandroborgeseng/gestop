'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Sheet } from '@/components/ui/sheet';
import { useSnackbar } from '@/components/ui/snackbar';
import { useSessionUser } from '@/components/auth/session-context';
import { ChamadoTarefaSheet } from '@/components/chamados/chamado-tarefa-sheet';
import { createChamadoTarefa, getOpcoesTarefa, listTarefasDoChamado } from '@/lib/api';
import { TAREFA_PRIORIDADE_LABEL, TAREFA_STATUS_LABEL, type ChamadoTarefaResumo } from '@/lib/chamado-tarefa';
import { canGerirTarefasChamado } from '@/lib/permissions-matrix';

export function ChamadoTarefasPanel({ chamadoId, onClose }: { chamadoId: string; onClose: () => void }) {
  const snackbar = useSnackbar();
  const user = useSessionUser();
  const searchParams = useSearchParams();
  const podeCriar = canGerirTarefasChamado(user?.permissoes ?? [], 'inserir');
  const [items, setItems] = useState<ChamadoTarefaResumo[]>([]);
  const [pendentes, setPendentes] = useState(0);
  const [aberta, setAberta] = useState<string | null>(searchParams.get('tarefa'));
  const [nova, setNova] = useState(false);

  function carregar() {
    listTarefasDoChamado(chamadoId)
      .then((data) => {
        setItems(data.items);
        setPendentes(data.pendentes);
      })
      .catch((err) => snackbar.show(err instanceof Error ? err.message : 'Falha ao listar tarefas.', 'error'));
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chamadoId]);

  return (
    <section className="rounded-[16px] border border-[var(--line)] bg-[var(--canvas)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[15px] font-semibold text-[var(--ink)]">Tarefas do chamado</h3>
          <p className="text-[12px] text-[var(--ink-3)]">{pendentes} pendente(s). A tarefa não altera o status do chamado.</p>
        </div>
        <div className="flex gap-2">
          {podeCriar ? (
            <Button type="button" size="sm" variant="filled" onClick={() => setNova(true)}>
              Nova tarefa
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="text" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
      <ul className="mt-3 space-y-2">
        {items.length === 0 ? <li className="text-[13px] text-[var(--ink-3)]">Nenhuma tarefa neste chamado.</li> : null}
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => setAberta(item.id)}
              className={`w-full rounded-[12px] border px-3 py-2 text-left ${item.atrasada ? 'border-amber-400 bg-amber-50' : item.status === 'IMPEDIDA' ? 'border-orange-300 bg-orange-50' : item.status === 'NOVA' ? 'border-sky-200 bg-sky-50' : 'border-[var(--line)]'}`}
            >
              <span className="font-medium text-[var(--ink)]">{item.titulo}</span>
              <span className="mt-0.5 block text-[12px] text-[var(--ink-3)]">
                {TAREFA_STATUS_LABEL[item.status]} · {TAREFA_PRIORIDADE_LABEL[item.prioridade] ?? item.prioridade}
                {item.secretaria ? ` · ${item.secretaria.sigla}` : ''}
                {item.equipe ? ` · ${item.equipe.nome}` : ''}
                {item.responsavel ? ` · ${item.responsavel.nome}` : ''}
                {item.prazo ? ` · ${new Date(item.prazo).toLocaleDateString('pt-BR')}` : ''}
                {item.atrasada ? ' · Atrasada' : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <NovaTarefaDialog
        open={nova}
        chamadoId={chamadoId}
        onClose={() => setNova(false)}
        onCreated={() => {
          setNova(false);
          carregar();
        }}
      />
      <ChamadoTarefaSheet tarefaId={aberta} onClose={() => setAberta(null)} onChanged={carregar} />
    </section>
  );
}

function NovaTarefaDialog({
  open,
  chamadoId,
  onClose,
  onCreated,
}: {
  open: boolean;
  chamadoId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const snackbar = useSnackbar();
  const [secretarias, setSecretarias] = useState<Array<{ id: string; nome: string; sigla: string }>>([]);
  const [equipes, setEquipes] = useState<
    Array<{ id: string; nome: string; membros: Array<{ usuario: { id: string; nome: string } }> }>
  >([]);
  const [secretariaId, setSecretariaId] = useState('');
  const [equipeId, setEquipeId] = useState('');
  const [responsavelId, setResponsavelId] = useState('');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [prazo, setPrazo] = useState('');
  const [prioridade, setPrioridade] = useState('MEDIA');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    getOpcoesTarefa()
      .then((data) => setSecretarias(data.secretarias))
      .catch((err) => snackbar.show(err instanceof Error ? err.message : 'Falha ao carregar secretarias.', 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!secretariaId) {
      setEquipes([]);
      return;
    }
    getOpcoesTarefa(secretariaId)
      .then((data) => setEquipes(data.equipes))
      .catch(() => setEquipes([]));
  }, [secretariaId]);

  const membros = equipes.find((item) => item.id === equipeId)?.membros ?? [];

  async function salvar() {
    if (titulo.trim().length < 3 || !secretariaId) {
      snackbar.show('Informe título e secretaria da tarefa.', 'error');
      return;
    }
    setBusy(true);
    try {
      await createChamadoTarefa({
        chamadoId,
        titulo: titulo.trim(),
        descricao: descricao.trim() || undefined,
        prazo: prazo ? new Date(prazo).toISOString() : undefined,
        secretariaId,
        equipeId: equipeId || undefined,
        responsavelId: responsavelId || undefined,
        prioridade,
      });
      snackbar.show('Tarefa criada.', 'success');
      setTitulo('');
      setDescricao('');
      onCreated();
    } catch (err) {
      snackbar.show(err instanceof Error ? err.message : 'Falha ao criar a tarefa.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Nova tarefa">
      <div className="space-y-3">
        <Field label="Título">
          <input value={titulo} onChange={(event) => setTitulo(event.target.value)} className="h-10 w-full rounded-[10px] border border-[var(--line)] px-3" />
        </Field>
        <Field label="Descrição">
          <textarea value={descricao} onChange={(event) => setDescricao(event.target.value)} className="min-h-16 w-full rounded-[10px] border border-[var(--line)] p-2" />
        </Field>
        <Field label="Secretaria responsável">
          <select
            value={secretariaId}
            onChange={(event) => {
              setSecretariaId(event.target.value);
              setEquipeId('');
              setResponsavelId('');
            }}
            className="h-10 w-full rounded-[10px] border border-[var(--line)] px-3"
          >
            <option value="">Selecione</option>
            {secretarias.map((item) => (
              <option key={item.id} value={item.id}>
                {item.sigla} · {item.nome}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Equipe">
          <select
            value={equipeId}
            onChange={(event) => {
              setEquipeId(event.target.value);
              setResponsavelId('');
            }}
            className="h-10 w-full rounded-[10px] border border-[var(--line)] px-3"
          >
            <option value="">Sem equipe</option>
            {equipes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Responsável (opcional)">
          <select value={responsavelId} onChange={(event) => setResponsavelId(event.target.value)} className="h-10 w-full rounded-[10px] border border-[var(--line)] px-3">
            <option value="">Sem responsável individual</option>
            {membros.map((item) => (
              <option key={item.usuario.id} value={item.usuario.id}>
                {item.usuario.nome}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Prazo">
          <input type="datetime-local" value={prazo} onChange={(event) => setPrazo(event.target.value)} className="h-10 w-full rounded-[10px] border border-[var(--line)] px-3" />
        </Field>
        <Field label="Prioridade">
          <select value={prioridade} onChange={(event) => setPrioridade(event.target.value)} className="h-10 w-full rounded-[10px] border border-[var(--line)] px-3">
            {Object.entries(TAREFA_PRIORIDADE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Button type="button" variant="filled" size="sm" disabled={busy} onClick={() => void salvar()}>
          Criar tarefa
        </Button>
      </div>
    </Sheet>
  );
}
