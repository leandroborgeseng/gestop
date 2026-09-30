'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChamadosExecucaoMap } from '@/components/chamados/chamados-execucao-map';
import { ChamadoTarefaSheet } from '@/components/chamados/chamado-tarefa-sheet';
import { Badge } from '@/components/ui/badge';
import { Chip } from '@/components/ui/chip';
import { getSecretarias, listEquipesExecucao, listTarefasExecucao, listTiposChamadoOpcoes, listUsuariosAtivosExecucao } from '@/lib/api';
import { TAREFA_PRIORIDADE_LABEL, TAREFA_STATUS_LABEL, TAREFA_STATUS_PENDENTES, type TarefasExecucaoResponse } from '@/lib/chamado-tarefa';
import type { ChamadoMapPoint } from '@/lib/types';

export function ExecucaoTarefasPanel() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<TarefasExecucaoResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [atribuidaAMim, setAtribuidaAMim] = useState(false);
  const [minhasEquipes, setMinhasEquipes] = useState(false);
  const [atrasadas, setAtrasadas] = useState(false);
  const [historico, setHistorico] = useState(false);
  const [prazoFrom, setPrazoFrom] = useState('');
  const [prazoTo, setPrazoTo] = useState('');
  const [secretariaId, setSecretariaId] = useState('');
  const [equipeId, setEquipeId] = useState('');
  const [responsavelId, setResponsavelId] = useState('');
  const [tipoChamadoId, setTipoChamadoId] = useState('');
  const [prioridade, setPrioridade] = useState('');
  const [secretarias, setSecretarias] = useState<Array<{ id: string; nome: string; sigla: string }>>([]);
  const [equipes, setEquipes] = useState<Array<{ id: string; nome: string }>>([]);
  const [responsaveis, setResponsaveis] = useState<Array<{ id: string; nome: string }>>([]);
  const [tipos, setTipos] = useState<Array<{ id: string; nome: string }>>([]);
  const [aberta, setAberta] = useState<string | null>(searchParams.get('tarefa'));
  const [mobile, setMobile] = useState<'lista' | 'mapa'>('lista');

  function carregar() {
    setErro(null);
    listTarefasExecucao({
      status: status || undefined,
      atribuidaAMim: atribuidaAMim ? '1' : undefined,
      minhasEquipes: minhasEquipes ? '1' : undefined,
      atrasadas: atrasadas ? '1' : undefined,
      historico: historico ? '1' : undefined,
      prazoFrom: prazoFrom ? new Date(prazoFrom).toISOString() : undefined,
      prazoTo: prazoTo ? new Date(prazoTo).toISOString() : undefined,
      secretariaId: secretariaId || undefined,
      equipeId: equipeId || undefined,
      responsavelId: responsavelId || undefined,
      tipoChamadoId: tipoChamadoId || undefined,
      prioridade: prioridade || undefined,
    })
      .then(setData)
      .catch((err) => setErro(err instanceof Error ? err.message : 'Falha ao carregar tarefas.'));
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, atribuidaAMim, minhasEquipes, atrasadas, historico, prazoFrom, prazoTo, secretariaId, equipeId, responsavelId, tipoChamadoId, prioridade]);

  useEffect(() => {
    getSecretarias().then(setSecretarias).catch(() => setSecretarias([]));
    listEquipesExecucao().then(setEquipes).catch(() => setEquipes([]));
    listUsuariosAtivosExecucao().then(setResponsaveis).catch(() => setResponsaveis([]));
    listTiposChamadoOpcoes().then(setTipos).catch(() => setTipos([]));
  }, []);

  const pontos = useMemo<ChamadoMapPoint[]>(() => {
    return (data?.items ?? [])
      .filter((item) => item.chamado.latitude != null && item.chamado.longitude != null)
      .map((item) => ({
        id: item.id,
        codigo: item.chamado.codigo,
        titulo: item.titulo,
        latitude: item.chamado.latitude as number,
        longitude: item.chamado.longitude as number,
        unidadeNome: `Tarefa · ${item.chamado.unidade?.nome || item.chamado.enderecoTexto || 'Sem endereço'}`,
        prioridade: TAREFA_PRIORIDADE_LABEL[item.prioridade] ?? item.prioridade,
        equipeNome: item.equipe?.nome,
        prazoEm: item.prazo,
      }));
  }, [data]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Badge variant="neutral">{data?.contadores.novas ?? 0} novas</Badge>
        <Badge variant="warning">{data?.contadores.emAndamento ?? 0} em andamento</Badge>
        <Badge variant="danger">{data?.contadores.impedidas ?? 0} impedidas</Badge>
        <Badge variant="danger">{data?.contadores.atrasadas ?? 0} atrasadas</Badge>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <Chip active={atribuidaAMim} onClick={() => setAtribuidaAMim((value) => !value)}>
          Atribuídas a mim
        </Chip>
        <Chip active={minhasEquipes} onClick={() => setMinhasEquipes((value) => !value)}>
          Minhas equipes
        </Chip>
        <Chip active={atrasadas} onClick={() => setAtrasadas((value) => !value)}>
          Atrasadas
        </Chip>
        <Chip active={historico} onClick={() => setHistorico((value) => !value)}>
          Histórico
        </Chip>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-9 rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-2 text-[12px]">
          <option value="">Status não finalizados</option>
          {TAREFA_STATUS_PENDENTES.map((item) => (
            <option key={item} value={item}>
              {TAREFA_STATUS_LABEL[item]}
            </option>
          ))}
          <option value="CONCLUIDA">Concluída</option>
          <option value="CANCELADA">Cancelada</option>
        </select>
        <select value={secretariaId} onChange={(event) => setSecretariaId(event.target.value)} className="h-9 rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-2 text-[12px]">
          <option value="">Secretaria da tarefa</option>
          {secretarias.map((item) => (
            <option key={item.id} value={item.id}>
              {item.sigla}
            </option>
          ))}
        </select>
        <select value={equipeId} onChange={(event) => setEquipeId(event.target.value)} className="h-9 rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-2 text-[12px]">
          <option value="">Equipe</option>
          {equipes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.nome}
            </option>
          ))}
        </select>
        <select value={responsavelId} onChange={(event) => setResponsavelId(event.target.value)} className="h-9 rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-2 text-[12px]">
          <option value="">Responsável</option>
          {responsaveis.map((item) => (
            <option key={item.id} value={item.id}>
              {item.nome}
            </option>
          ))}
        </select>
        <select value={tipoChamadoId} onChange={(event) => setTipoChamadoId(event.target.value)} className="h-9 rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-2 text-[12px]">
          <option value="">Tipo de chamado</option>
          {tipos.map((item) => (
            <option key={item.id} value={item.id}>
              {item.nome}
            </option>
          ))}
        </select>
        <select value={prioridade} onChange={(event) => setPrioridade(event.target.value)} className="h-9 rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-2 text-[12px]">
          <option value="">Prioridade</option>
          {Object.entries(TAREFA_PRIORIDADE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input type="date" value={prazoFrom} onChange={(event) => setPrazoFrom(event.target.value)} className="h-9 rounded-[10px] border border-[var(--line)] px-2 text-[12px]" />
        <input type="date" value={prazoTo} onChange={(event) => setPrazoTo(event.target.value)} className="h-9 rounded-[10px] border border-[var(--line)] px-2 text-[12px]" />
      </div>
      {erro ? <p className="text-[13px] text-[var(--danger)]">{erro}</p> : null}
      <div className="flex gap-2 xl:hidden">
        <Chip active={mobile === 'lista'} onClick={() => setMobile('lista')}>
          Lista
        </Chip>
        <Chip active={mobile === 'mapa'} onClick={() => setMobile('mapa')}>
          Mapa
        </Chip>
      </div>
      <div className="grid gap-3 xl:grid-cols-[1.1fr_0.9fr]">
        <div className={`max-h-[70dvh] overflow-auto ${mobile === 'lista' ? 'block' : 'hidden xl:block'}`}>
          <table className="w-full min-w-[720px] text-left text-[12px]">
            <thead className="text-[var(--ink-3)]">
              <tr>
                <th className="p-2">Chamado</th>
                <th className="p-2">Tarefa</th>
                <th className="p-2">Status</th>
                <th className="p-2">Prazo</th>
                <th className="p-2">Prioridade</th>
                <th className="p-2">Secretaria</th>
                <th className="p-2">Equipe</th>
                <th className="p-2">Responsável</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map((item) => (
                <tr
                  key={item.id}
                  className={`cursor-pointer border-t border-[var(--line)] ${item.atrasada ? 'bg-amber-50' : item.status === 'IMPEDIDA' ? 'bg-orange-50' : item.status === 'NOVA' ? 'bg-sky-50' : ''}`}
                  onClick={() => setAberta(item.id)}
                >
                  <td className="p-2 mono">{item.chamado.codigo}</td>
                  <td className="p-2">{item.titulo}</td>
                  <td className="p-2">{TAREFA_STATUS_LABEL[item.status]}</td>
                  <td className="p-2">{item.prazo ? new Date(item.prazo).toLocaleDateString('pt-BR') : '—'}</td>
                  <td className="p-2">{TAREFA_PRIORIDADE_LABEL[item.prioridade] ?? item.prioridade}</td>
                  <td className="p-2">{item.secretaria?.sigla ?? '—'}</td>
                  <td className="p-2">{item.equipe?.nome ?? '—'}</td>
                  <td className="p-2">{item.responsavel?.nome ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && data.items.length === 0 ? <p className="p-3 text-[13px] text-[var(--ink-3)]">Nenhuma tarefa neste filtro.</p> : null}
        </div>
        <div className={`min-h-[320px] ${mobile === 'mapa' ? 'block' : 'hidden xl:block'}`}>
          <ChamadosExecucaoMap pontos={pontos} selectedId={aberta} onSelect={setAberta} onPopupAction={setAberta} popupActionLabel="Executar tarefa" />
        </div>
      </div>
      <ChamadoTarefaSheet tarefaId={aberta} onClose={() => setAberta(null)} onChanged={carregar} />
    </div>
  );
}
