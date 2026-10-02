'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { ChamadosExecucaoMap } from '@/components/chamados/chamados-execucao-map';
import { ChamadoTarefaSheet } from '@/components/chamados/chamado-tarefa-sheet';
import { Badge } from '@/components/ui/badge';
import { Chip } from '@/components/ui/chip';
import { cn } from '@/lib/cn';
import { getSecretarias, listEquipesExecucao, listTarefasExecucao, listTiposChamadoOpcoes, listUsuariosAtivosExecucao } from '@/lib/api';
import { TAREFA_PRIORIDADE_LABEL, TAREFA_STATUS_LABEL, TAREFA_STATUS_PENDENTES, type TarefasExecucaoResponse } from '@/lib/chamado-tarefa';
import type { ChamadoMapPoint } from '@/lib/types';

export function ExecucaoTarefasPanel() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<TarefasExecucaoResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [atribuidaAMim, setAtribuidaAMim] = useState(searchParams.get('atribuidaAMim') === '1');
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
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

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
    if (searchParams.get('atribuidaAMim') === '1') setAtribuidaAMim(true);
    const tarefa = searchParams.get('tarefa');
    if (tarefa) setAberta(tarefa);
  }, [searchParams]);

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

  const resumoFiltros = useMemo(() => {
    const partes: string[] = [];
    if (status === 'IMPEDIDA') partes.push('Status: Impedida (histórico)');
    else if (status) partes.push(`Status: ${TAREFA_STATUS_LABEL[status as keyof typeof TAREFA_STATUS_LABEL] ?? status}`);
    else if (historico) partes.push('Status: histórico');
    else partes.push('Status: não finalizados');
    const secretaria = secretarias.find((item) => item.id === secretariaId);
    if (secretaria) partes.push(`Secretaria: ${secretaria.sigla}`);
    const equipe = equipes.find((item) => item.id === equipeId);
    if (equipe) partes.push(`Equipe: ${equipe.nome}`);
    const responsavel = responsaveis.find((item) => item.id === responsavelId);
    if (responsavel) partes.push(`Responsável: ${responsavel.nome}`);
    const tipo = tipos.find((item) => item.id === tipoChamadoId);
    if (tipo) partes.push(`Tipo: ${tipo.nome}`);
    if (prioridade) partes.push(`Prioridade: ${TAREFA_PRIORIDADE_LABEL[prioridade] ?? prioridade}`);
    if (atribuidaAMim) partes.push('Atribuídas a mim');
    if (minhasEquipes) partes.push('Minhas equipes');
    if (atrasadas) partes.push('Atrasadas');
    if (prazoFrom || prazoTo) partes.push('Prazo');
    return partes.length ? partes.join(' · ') : 'Nenhum filtro ativo';
  }, [
    atrasadas,
    atribuidaAMim,
    equipeId,
    equipes,
    historico,
    minhasEquipes,
    prazoFrom,
    prazoTo,
    prioridade,
    responsavelId,
    responsaveis,
    secretariaId,
    secretarias,
    status,
    tipoChamadoId,
    tipos,
  ]);

  const campo = 'h-9 w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-2 text-[12px]';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Badge variant="neutral">{data?.contadores.novas ?? 0} novas</Badge>
        <Badge variant="warning">{data?.contadores.emAndamento ?? 0} em andamento</Badge>
        <Badge variant="danger">{data?.contadores.atrasadas ?? 0} atrasadas</Badge>
      </div>
      <div className="overflow-hidden rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)]">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left"
          onClick={() => setFiltrosAbertos((current) => !current)}
          aria-expanded={filtrosAbertos}
        >
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[var(--ink)]">Filtros de tarefas</p>
            {!filtrosAbertos ? <p className="mt-0.5 truncate text-[11px] text-[var(--ink-3)]">{resumoFiltros}</p> : null}
          </div>
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-[var(--ink-3)] transition-transform', filtrosAbertos ? 'rotate-180' : '')} />
        </button>
        {filtrosAbertos ? (
          <div className="space-y-3 border-t border-[var(--line-2)] px-3.5 py-3.5">
            <div className="flex flex-wrap gap-1.5">
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
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <FiltroRotulo label="Status">
                <select value={status} onChange={(event) => setStatus(event.target.value)} className={campo}>
                  <option value="">Não finalizados</option>
                  {TAREFA_STATUS_PENDENTES.map((item) => (
                    <option key={item} value={item}>
                      {TAREFA_STATUS_LABEL[item]}
                    </option>
                  ))}
                  <option value="CONCLUIDA">Concluída</option>
                  <option value="CANCELADA">Cancelada</option>
                  <option value="IMPEDIDA">Impedida (histórico)</option>
                </select>
              </FiltroRotulo>
              <FiltroRotulo label="Secretaria da tarefa">
                <select value={secretariaId} onChange={(event) => setSecretariaId(event.target.value)} className={campo}>
                  <option value="">Todas</option>
                  {secretarias.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.sigla}
                    </option>
                  ))}
                </select>
              </FiltroRotulo>
              <FiltroRotulo label="Equipe">
                <select value={equipeId} onChange={(event) => setEquipeId(event.target.value)} className={campo}>
                  <option value="">Todas</option>
                  {equipes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome}
                    </option>
                  ))}
                </select>
              </FiltroRotulo>
              <FiltroRotulo label="Responsável">
                <select value={responsavelId} onChange={(event) => setResponsavelId(event.target.value)} className={campo}>
                  <option value="">Todos</option>
                  {responsaveis.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome}
                    </option>
                  ))}
                </select>
              </FiltroRotulo>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <FiltroRotulo label="Tipo de chamado">
                <select value={tipoChamadoId} onChange={(event) => setTipoChamadoId(event.target.value)} className={campo}>
                  <option value="">Todos</option>
                  {tipos.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome}
                    </option>
                  ))}
                </select>
              </FiltroRotulo>
              <FiltroRotulo label="Prioridade">
                <select value={prioridade} onChange={(event) => setPrioridade(event.target.value)} className={campo}>
                  <option value="">Todas</option>
                  {Object.entries(TAREFA_PRIORIDADE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </FiltroRotulo>
              <FiltroRotulo label="Data inicial">
                <input type="date" value={prazoFrom} onChange={(event) => setPrazoFrom(event.target.value)} className={campo} />
              </FiltroRotulo>
              <FiltroRotulo label="Data final">
                <input type="date" value={prazoTo} onChange={(event) => setPrazoTo(event.target.value)} className={campo} />
              </FiltroRotulo>
            </div>
          </div>
        ) : null}
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

function FiltroRotulo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">{label}</span>
      {children}
    </label>
  );
}
