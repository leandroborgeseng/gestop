'use client';

import { useEffect, useState } from 'react';
import { Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Sheet } from '@/components/ui/sheet';
import { useSnackbar } from '@/components/ui/snackbar';
import { ZoomableAuthenticatedImage } from '@/components/ui/zoomable-authenticated-image';
import { getChamadoLeituraViaTarefa, getChamadoTarefa, getOpcoesTarefa, updateChamadoTarefa } from '@/lib/api';
import { ChamadoTarefaChamadoLeituraView } from '@/components/chamados/chamado-tarefa-chamado-leitura';
import {
  ANEXOS_ABERTURA_ACCEPT,
  ANEXOS_ABERTURA_FORMATOS,
  categoriaDoMime,
  lerArquivoComoDataUrl,
  mensagemArquivoAbertura,
  mimeDeArquivo,
  type AnexoAberturaDraft,
} from '@/lib/chamado-anexos-abertura';
import {
  TAREFA_PRIORIDADE_LABEL,
  TAREFA_STATUS_LABEL,
  type ChamadoTarefaChamadoLeitura,
  type ChamadoTarefaDetalhe,
  type ChamadoTarefaStatus,
} from '@/lib/chamado-tarefa';
import { baixarStorageAutenticado, fetchAuthenticatedStorageBlob } from '@/lib/storage-url';

type Acao = 'editar' | 'andamento' | 'concluir' | 'cancelar';
type AnexoPronto = { nome: string; dataUrl: string; mimeType: string };

const ACAO_HISTORICO: Record<string, string> = {
  criada: 'Criação',
  visualizada: 'Visualização',
  editada: 'Alteração',
  andamento: 'Andamento',
  concluida: 'Conclusão',
  cancelada: 'Cancelamento',
  impedida: 'Impedimento',
  anexo: 'Anexo',
  prazo: 'Alteração',
  atribuicao: 'Alteração',
  responsavel: 'Responsável',
  equipe: 'Equipe',
  atualizada: 'Alteração',
};

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
  const [chamadoLeitura, setChamadoLeitura] = useState<ChamadoTarefaChamadoLeitura | null>(null);
  const [busy, setBusy] = useState(false);
  const [acao, setAcao] = useState<Acao | null>(null);
  const [texto, setTexto] = useState('');
  const [anexos, setAnexos] = useState<AnexoPronto[]>([]);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [secretariaId, setSecretariaId] = useState('');
  const [equipeId, setEquipeId] = useState('');
  const [responsavelId, setResponsavelId] = useState('');
  const [prazo, setPrazo] = useState('');
  const [prioridade, setPrioridade] = useState('MEDIA');
  const [secretarias, setSecretarias] = useState<Array<{ id: string; nome: string; sigla: string }>>([]);
  const [equipes, setEquipes] = useState<Array<{ id: string; nome: string; membros: Array<{ usuario: { id: string; nome: string } }> }>>([]);

  useEffect(() => {
    if (!tarefaId) {
      setTarefa(null);
      setChamadoLeitura(null);
      setAcao(null);
      return;
    }
    let ativo = true;
    getChamadoTarefa(tarefaId)
      .then(async (data) => {
        if (!ativo) return;
        setTarefa(data);
        preencherEdicao(data);
        try {
          const leitura = await getChamadoLeituraViaTarefa(data.id, data.chamado.id);
          if (!ativo) return;
          setChamadoLeitura(leitura);
        } catch {
          if (!ativo) return;
          setChamadoLeitura(null);
        }
      })
      .catch((err) => snackbar.show(err instanceof Error ? err.message : 'Falha ao abrir a tarefa.', 'error'));
    return () => {
      ativo = false;
    };
    // snackbar muda de identidade; a carga segue só o id da tarefa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarefaId]);

  useEffect(() => {
    if (acao !== 'editar') return;
    getOpcoesTarefa()
      .then((data) => setSecretarias(data.secretarias))
      .catch(() => setSecretarias([]));
  }, [acao]);

  useEffect(() => {
    if (acao !== 'editar' || !secretariaId) {
      setEquipes([]);
      return;
    }
    getOpcoesTarefa(secretariaId)
      .then((data) => setEquipes(data.equipes))
      .catch(() => setEquipes([]));
  }, [acao, secretariaId]);

  function preencherEdicao(data: ChamadoTarefaDetalhe) {
    setTitulo(data.titulo);
    setDescricao(data.descricao ?? '');
    setSecretariaId(data.secretaria?.id ?? '');
    setEquipeId(data.equipe?.id ?? '');
    setResponsavelId(data.responsavel?.id ?? '');
    setPrazo(paraDataLocal(data.prazo));
    setPrioridade(data.prioridade);
  }

  function limparAcao() {
    setAcao(null);
    setTexto('');
    setAnexos([]);
  }

  async function salvarEdicao() {
    if (!tarefa) return;
    if (titulo.trim().length < 3 || !secretariaId) {
      snackbar.show('Informe título e secretaria da tarefa.', 'error');
      return;
    }
    setBusy(true);
    try {
      const atualizada = await updateChamadoTarefa(tarefa.id, {
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        secretariaId,
        equipeId: equipeId || null,
        responsavelId: responsavelId || null,
        prazo: prazo ? new Date(prazo).toISOString() : null,
        prioridade,
      });
      setTarefa(atualizada);
      preencherEdicao(atualizada);
      limparAcao();
      snackbar.show('Dados da tarefa atualizados.', 'success');
      onChanged?.();
    } catch (err) {
      snackbar.show(err instanceof Error ? err.message : 'Falha ao atualizar a tarefa.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function salvarAcao(status: Extract<ChamadoTarefaStatus, 'EM_ANDAMENTO' | 'CONCLUIDA' | 'CANCELADA'>) {
    if (!tarefa) return;
    if (texto.trim().length < 3) {
      snackbar.show(
        status === 'CONCLUIDA'
          ? 'Informe o texto de conclusão da tarefa.'
          : status === 'CANCELADA'
            ? 'Informe a justificativa do cancelamento.'
            : 'Informe o registro de andamento.',
        'error',
      );
      return;
    }
    setBusy(true);
    try {
      const atualizada = await updateChamadoTarefa(tarefa.id, {
        status,
        observacao: status === 'EM_ANDAMENTO' ? texto.trim() : undefined,
        conclusaoTexto: status === 'CONCLUIDA' ? texto.trim() : undefined,
        justificativa: status === 'CANCELADA' ? texto.trim() : undefined,
        anexos: anexos.map((item) => ({ dataUrl: item.dataUrl, nome: item.nome })),
      });
      setTarefa(atualizada);
      limparAcao();
      snackbar.show('Tarefa atualizada.', 'success');
      onChanged?.();
    } catch (err) {
      snackbar.show(err instanceof Error ? err.message : 'Falha ao atualizar a tarefa.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function escolherArquivos(files: FileList | null) {
    if (!files?.length) return;
    const aceitos: AnexoPronto[] = [];
    let atuais: AnexoAberturaDraft[] = anexos.map((item) => ({
      id: item.nome,
      nome: item.nome,
      mimeType: item.mimeType,
      dataUrl: item.dataUrl,
      categoria: categoriaDoMime(item.mimeType),
    }));
    for (const file of Array.from(files)) {
      const mensagem = mensagemArquivoAbertura(file, atuais)?.replace(' na abertura', '');
      if (mensagem) {
        snackbar.show(mensagem, 'warning');
        continue;
      }
      const mimeType = mimeDeArquivo(file);
      if (!mimeType) continue;
      const dataUrl = await lerArquivoComoDataUrl(file);
      aceitos.push({ nome: file.name, dataUrl, mimeType });
      atuais = [...atuais, { id: file.name, nome: file.name, mimeType, dataUrl, categoria: categoriaDoMime(mimeType) }];
    }
    if (aceitos.length) setAnexos((current) => [...current, ...aceitos]);
  }

  const membros = equipes.find((item) => item.id === equipeId)?.membros ?? [];

  return (
    <Sheet open={Boolean(tarefaId)} onClose={onClose} title="Executar tarefa" className="max-w-xl">
      {!tarefa ? (
        <p className="text-[13px] text-[var(--ink-3)]">Carregando tarefa…</p>
      ) : (
        <div className="space-y-3 text-[13px]">
          <p className="mono text-[12px] font-semibold text-[var(--brand-hover)]">{tarefa.chamado.codigo}</p>
          <h3 className="text-[16px] font-semibold text-[var(--ink)]">{tarefa.titulo}</h3>
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-semibold text-[var(--ink-2)]">
              {TAREFA_STATUS_LABEL[tarefa.status]}
            </span>
            <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-semibold text-[var(--ink-2)]">
              {TAREFA_PRIORIDADE_LABEL[tarefa.prioridade] ?? tarefa.prioridade}
            </span>
            {tarefa.atrasada ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">Atrasada</span>
            ) : null}
          </div>
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

          <div className="flex flex-wrap gap-2 border-t border-[var(--line)] pt-3">
            {tarefa.podeAlterarDados ? (
              <Button type="button" size="sm" variant="outlined" disabled={busy} onClick={() => { setAcao('editar'); preencherEdicao(tarefa); }}>
                Editar dados da tarefa
              </Button>
            ) : null}
            {tarefa.podeAndamento ? (
              <Button type="button" size="sm" variant="outlined" disabled={busy} onClick={() => { limparAcao(); setAcao('andamento'); }}>
                Registrar andamento
              </Button>
            ) : null}
            {tarefa.podeConcluir ? (
              <Button type="button" size="sm" variant="filled" disabled={busy} onClick={() => { limparAcao(); setAcao('concluir'); }}>
                Concluir tarefa
              </Button>
            ) : null}
            {tarefa.podeCancelar ? (
              <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => { limparAcao(); setAcao('cancelar'); }}>
                Cancelar tarefa
              </Button>
            ) : null}
          </div>

          {acao === 'editar' ? (
            <div className="space-y-2 rounded-[12px] border border-[var(--line)] p-3">
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
              <Field label="Responsável">
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
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="filled" disabled={busy} onClick={() => void salvarEdicao()}>
                  Salvar dados
                </Button>
                <Button type="button" size="sm" variant="text" disabled={busy} onClick={limparAcao}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : null}

          {acao === 'andamento' || acao === 'concluir' || acao === 'cancelar' ? (
            <div className="space-y-2 rounded-[12px] border border-[var(--line)] p-3">
              <Field
                label={acao === 'concluir' ? 'Texto de conclusão' : acao === 'cancelar' ? 'Justificativa' : 'Registro de andamento'}
              >
                <textarea value={texto} onChange={(event) => setTexto(event.target.value)} className="min-h-20 w-full rounded-[10px] border border-[var(--line)] p-2" />
              </Field>
              <label className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-[10px] border border-[var(--line)] px-3 py-2 text-[12px] font-semibold">
                <Paperclip className="h-3.5 w-3.5" />
                Anexar arquivos
                <input
                  type="file"
                  multiple
                  accept={ANEXOS_ABERTURA_ACCEPT}
                  className="hidden"
                  disabled={busy}
                  onChange={(event) => {
                    void escolherArquivos(event.target.files);
                    event.target.value = '';
                  }}
                />
              </label>
              <p className="text-[12px] text-[var(--ink-3)]">Formatos permitidos: {ANEXOS_ABERTURA_FORMATOS}.</p>
              {anexos.length ? (
                <ul className="space-y-1">
                  {anexos.map((item) => (
                    <li key={`${item.nome}-${item.dataUrl.length}`} className="flex items-center justify-between gap-2 text-[12px]">
                      <span className="truncate">{item.nome}</span>
                      <button type="button" aria-label={`Remover ${item.nome}`} onClick={() => setAnexos((current) => current.filter((anexo) => anexo !== item))}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="filled"
                  disabled={busy}
                  onClick={() =>
                    void salvarAcao(acao === 'concluir' ? 'CONCLUIDA' : acao === 'cancelar' ? 'CANCELADA' : 'EM_ANDAMENTO')
                  }
                >
                  Salvar
                </Button>
                <Button type="button" size="sm" variant="text" disabled={busy} onClick={limparAcao}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : null}

          {tarefa.podeVerHistorico !== false ? (
            <section className="space-y-2 border-t border-[var(--line)] pt-3">
              <h4 className="text-[12px] font-bold tracking-wide text-[var(--ink-3)] uppercase">Histórico da tarefa</h4>
              {tarefa.historico.length ? (
                <ol className="space-y-2">
                  {tarefa.historico.map((item) => {
                    const ligados = (item.anexoIds ?? [])
                      .map((id) => tarefa.anexos.find((anexo) => anexo.id === id))
                      .filter((anexo): anexo is ChamadoTarefaDetalhe['anexos'][number] => Boolean(anexo));
                    return (
                      <li key={item.id} className="rounded-[10px] bg-[var(--surface-2)] p-2 text-[12px]">
                        <p className="font-semibold text-[var(--ink)]">
                          {ACAO_HISTORICO[item.acao ?? ''] ?? 'Registro'}
                          {item.motivo ? ` · ${item.motivo}` : ''}
                        </p>
                        <p className="text-[var(--ink-3)]">
                          {[new Date(item.createdAt).toLocaleString('pt-BR'), item.alteradoPor?.nome, item.perfil, item.secretaria]
                            .filter(Boolean)
                            .join(' · ')}
                          {item.temAnexos ? ' · Há anexos' : ''}
                        </p>
                        {ligados.length ? (
                          <ul className="mt-2 space-y-2">
                            {ligados.map((anexo) => (
                              <AnexoLinha key={anexo.id} anexo={anexo} />
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="text-[12px] text-[var(--ink-3)]">Nenhum registro ainda.</p>
              )}
              <AnexosSoltos tarefa={tarefa} />
            </section>
          ) : null}

          {chamadoLeitura ? <ChamadoTarefaChamadoLeituraView leitura={chamadoLeitura} /> : null}
        </div>
      )}
    </Sheet>
  );
}

function AnexosSoltos({ tarefa }: { tarefa: ChamadoTarefaDetalhe }) {
  const ligados = new Set(tarefa.historico.flatMap((item) => item.anexoIds ?? []));
  const soltos = tarefa.anexos.filter((item) => !ligados.has(item.id));
  if (!soltos.length) return null;
  return (
    <div>
      <p className="text-[12px] text-[var(--ink-3)]">Anexos anteriores</p>
      <ul className="mt-1 space-y-2">
        {soltos.map((anexo) => (
          <AnexoLinha key={anexo.id} anexo={anexo} />
        ))}
      </ul>
    </div>
  );
}

function AnexoLinha({ anexo }: { anexo: { id: string; nome: string; url: string; mimeType: string | null } }) {
  const mime = anexo.mimeType ?? '';
  if (mime.startsWith('image/')) {
    return (
      <li>
        <ZoomableAuthenticatedImage src={anexo.url} alt={anexo.nome} className="h-24 w-full object-cover" />
      </li>
    );
  }
  return (
    <li>
      <button
        type="button"
        className="text-[var(--brand)] underline"
        onClick={() => void abrirAnexo(anexo.url, anexo.nome, mime)}
      >
        {anexo.nome} · {mime.startsWith('video/') ? 'Abrir vídeo' : 'Abrir'}
      </button>
    </li>
  );
}

async function abrirAnexo(url: string, nome: string, mime: string) {
  if (mime.startsWith('video/')) {
    const blob = await fetchAuthenticatedStorageBlob(url);
    if (!blob) return;
    const typed = blob.type && blob.type !== 'application/octet-stream' ? blob : new Blob([blob], { type: mime });
    const objectUrl = URL.createObjectURL(typed);
    window.open(objectUrl, '_blank', 'noopener');
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    return;
  }
  await baixarStorageAutenticado(url, nome);
}

function paraDataLocal(iso: string | null) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
