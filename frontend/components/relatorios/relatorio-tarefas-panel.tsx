'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { downloadRelatorioTarefas, getRelatorioTarefas, getSecretarias, listEquipesExecucao, listTiposChamadoOpcoes, listUsuariosAtivosExecucao } from '@/lib/api';
import { TAREFA_PRIORIDADE_LABEL, TAREFA_STATUS_LABEL, type RelatorioTarefasResponse } from '@/lib/chamado-tarefa';

export function RelatorioTarefasPanel() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('');
  const [prioridade, setPrioridade] = useState('');
  const [secretariaId, setSecretariaId] = useState('');
  const [equipeId, setEquipeId] = useState('');
  const [responsavelId, setResponsavelId] = useState('');
  const [tipoChamadoId, setTipoChamadoId] = useState('');
  const [chamado, setChamado] = useState('');
  const [secretarias, setSecretarias] = useState<Array<{ id: string; nome: string; sigla: string }>>([]);
  const [equipes, setEquipes] = useState<Array<{ id: string; nome: string }>>([]);
  const [responsaveis, setResponsaveis] = useState<Array<{ id: string; nome: string }>>([]);
  const [tipos, setTipos] = useState<Array<{ id: string; nome: string }>>([]);

  useEffect(() => {
    getSecretarias().then(setSecretarias).catch(() => setSecretarias([]));
    listEquipesExecucao().then(setEquipes).catch(() => setEquipes([]));
    listUsuariosAtivosExecucao().then(setResponsaveis).catch(() => setResponsaveis([]));
    listTiposChamadoOpcoes().then(setTipos).catch(() => setTipos([]));
  }, []);
  const [data, setData] = useState<RelatorioTarefasResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exportando, setExportando] = useState<string | null>(null);
  const [aplicado, setAplicado] = useState<Record<string, string | undefined> | null>(null);

  function filtrosAtuais() {
    return {
      prazoFrom: from ? new Date(from).toISOString() : undefined,
      prazoTo: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
      status: status || undefined,
      prioridade: prioridade || undefined,
      secretariaId: secretariaId || undefined,
      equipeId: equipeId || undefined,
      responsavelId: responsavelId || undefined,
      tipoChamadoId: tipoChamadoId || undefined,
      search: chamado.trim() || undefined,
      capa: 'simples',
    };
  }

  async function gerar() {
    setLoading(true);
    setErro(null);
    const params = filtrosAtuais();
    try {
      setData(await getRelatorioTarefas(params));
      setAplicado(params);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao gerar o relatório.');
    } finally {
      setLoading(false);
    }
  }

  async function exportar(formato: 'csv' | 'pdf' | 'xlsx') {
    if (!aplicado) return;
    setExportando(formato);
    setErro(null);
    try {
      await downloadRelatorioTarefas(formato, aplicado);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao exportar.');
    } finally {
      setExportando(null);
    }
  }

  const indicadores = data?.indicadores;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-[12px] text-[var(--ink-3)]">
          Prazo de
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 block h-9 rounded-[10px] border border-[var(--line)] px-2" />
        </label>
        <label className="text-[12px] text-[var(--ink-3)]">
          até
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 block h-9 rounded-[10px] border border-[var(--line)] px-2" />
        </label>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-9 rounded-[10px] border border-[var(--line)] px-2 text-[12px]">
          <option value="">Todos os status</option>
          {Object.entries(TAREFA_STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select value={prioridade} onChange={(event) => setPrioridade(event.target.value)} className="h-9 rounded-[10px] border border-[var(--line)] px-2 text-[12px]">
          <option value="">Todas as prioridades</option>
          {Object.entries(TAREFA_PRIORIDADE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select value={secretariaId} onChange={(event) => setSecretariaId(event.target.value)} className="h-9 rounded-[10px] border border-[var(--line)] px-2 text-[12px]">
          <option value="">Secretaria</option>
          {secretarias.map((item) => (
            <option key={item.id} value={item.id}>{item.sigla}</option>
          ))}
        </select>
        <select value={equipeId} onChange={(event) => setEquipeId(event.target.value)} className="h-9 rounded-[10px] border border-[var(--line)] px-2 text-[12px]">
          <option value="">Equipe</option>
          {equipes.map((item) => (
            <option key={item.id} value={item.id}>{item.nome}</option>
          ))}
        </select>
        <select value={responsavelId} onChange={(event) => setResponsavelId(event.target.value)} className="h-9 rounded-[10px] border border-[var(--line)] px-2 text-[12px]">
          <option value="">Responsável</option>
          {responsaveis.map((item) => (
            <option key={item.id} value={item.id}>{item.nome}</option>
          ))}
        </select>
        <select value={tipoChamadoId} onChange={(event) => setTipoChamadoId(event.target.value)} className="h-9 rounded-[10px] border border-[var(--line)] px-2 text-[12px]">
          <option value="">Tipo de chamado</option>
          {tipos.map((item) => (
            <option key={item.id} value={item.id}>{item.nome}</option>
          ))}
        </select>
        <input value={chamado} onChange={(event) => setChamado(event.target.value)} placeholder="Chamado ou tarefa" className="h-9 rounded-[10px] border border-[var(--line)] px-2 text-[12px]" />
        <Button type="button" size="sm" variant="filled" disabled={loading} onClick={() => void gerar()}>
          {loading ? 'Gerando…' : 'Atualizar'}
        </Button>
      </div>
      {erro ? <p className="text-[13px] text-[var(--danger)]">{erro}</p> : null}
      {indicadores ? (
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Indicador label="Abertas" value={indicadores.abertas} />
          <Indicador label="Novas" value={indicadores.novas} />
          <Indicador label="Em andamento" value={indicadores.emAndamento} />
          <Indicador label="Impedidas" value={indicadores.impedidas} />
          <Indicador label="Concluídas" value={indicadores.concluidas} />
          <Indicador label="Atrasadas" value={indicadores.atrasadas} />
        </div>
      ) : null}
      {indicadores ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Grupo titulo="Por secretaria" itens={indicadores.porSecretaria} />
          <Grupo titulo="Por equipe" itens={indicadores.porEquipe} />
          <Grupo titulo="Por responsável" itens={indicadores.porResponsavel} />
          <Grupo titulo="Por tipo de chamado" itens={indicadores.porTipoChamado} />
        </div>
      ) : null}
      {data ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] text-[var(--ink-3)]">Exportar dados exibidos</span>
            {(['xlsx', 'csv', 'pdf'] as const).map((formato) => (
              <Button
                key={formato}
                type="button"
                size="sm"
                variant="outlined"
                disabled={Boolean(exportando)}
                onClick={() => void exportar(formato)}
              >
                {exportando === formato ? 'Exportando…' : formato.toUpperCase()}
              </Button>
            ))}
          </div>
          <div className="max-h-[360px] overflow-auto">
          <table className="w-full min-w-[880px] text-left text-[12px]">
            <thead className="text-[var(--ink-3)]">
              <tr>
                <th className="p-2">Chamado</th>
                <th className="p-2">Título do chamado</th>
                <th className="p-2">Tarefa</th>
                <th className="p-2">Status</th>
                <th className="p-2">Prazo</th>
                <th className="p-2">Criada</th>
                <th className="p-2">Concluída</th>
                <th className="p-2">Secretaria</th>
                <th className="p-2">Equipe</th>
                <th className="p-2">Responsável</th>
                <th className="p-2">Situação</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id} className="border-t border-[var(--line)]">
                  <td className="p-2 mono">{item.chamado.codigo}</td>
                  <td className="p-2">{item.chamado.titulo || item.chamado.descricao.slice(0, 60)}</td>
                  <td className="p-2">{item.titulo}</td>
                  <td className="p-2">{TAREFA_STATUS_LABEL[item.status]}</td>
                  <td className="p-2">{item.prazo ? new Date(item.prazo).toLocaleDateString('pt-BR') : '—'}</td>
                  <td className="p-2">{new Date(item.createdAt).toLocaleDateString('pt-BR')}</td>
                  <td className="p-2">{item.concluidaEm ? new Date(item.concluidaEm).toLocaleDateString('pt-BR') : '—'}</td>
                  <td className="p-2">{item.secretaria?.sigla ?? '—'}</td>
                  <td className="p-2">{item.equipe?.nome ?? '—'}</td>
                  <td className="p-2">{item.responsavel?.nome ?? '—'}</td>
                  <td className="p-2">{item.situacaoPrazo}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      ) : (
        <p className="text-[13px] text-[var(--ink-3)]">As tarefas não entram na contagem de chamados. Atualize para ver o relatório.</p>
      )}
    </div>
  );
}

function Indicador({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[12px] border border-[var(--line)] p-3">
      <p className="text-[11px] text-[var(--ink-3)]">{label}</p>
      <p className="text-[18px] font-semibold text-[var(--ink)]">{value}</p>
    </div>
  );
}

function Grupo({ titulo, itens }: { titulo: string; itens: Array<{ nome: string; total: number }> }) {
  return (
    <div>
      <p className="text-[12px] font-semibold text-[var(--ink-2)]">{titulo}</p>
      <ul className="mt-1 text-[12px] text-[var(--ink-3)]">
        {itens.slice(0, 6).map((item) => (
          <li key={item.nome}>
            {item.nome}: {item.total}
          </li>
        ))}
        {itens.length === 0 ? <li>Sem dados</li> : null}
      </ul>
    </div>
  );
}
