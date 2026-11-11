'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AVISO_REGISTRO_URL, detalheCobreLista } from '@/lib/estado-url';
import type { EstadoExecucao } from '@/lib/estado-url-execucao';
import { useEstadoExecucao } from '@/lib/use-estado-execucao';
import { ChevronDown, ListX, Search } from 'lucide-react';
import { ChamadosExecucaoMap } from '@/components/chamados/chamados-execucao-map';
import { ChamadoTarefaSheet } from '@/components/chamados/chamado-tarefa-sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui-states';
import { TarefasExecucaoList } from '@/components/chamados/tarefas-execucao-list';
import { Chip } from '@/components/ui/chip';
import { cn } from '@/lib/cn';
import { getSecretarias, listEquipesExecucao, listTarefasExecucao, listTiposChamadoOpcoes, listUsuariosAtivosExecucao } from '@/lib/api';
import { agruparPinsTarefas, filtrarTarefasBusca, montarParametrosTarefasExecucao, pinDaTarefa } from '@/lib/tarefa-card';
import {
  contarFiltrosAtivosTarefas,
  resumoFiltrosTarefasExecucao,
  rotuloContagemFiltros,
  TAREFA_PRIORIDADE_LABEL,
  TAREFA_STATUS_LABEL,
  TAREFA_STATUS_PENDENTES,
  type TarefasExecucaoResponse,
} from '@/lib/chamado-tarefa';

export function ExecucaoTarefasPanel({
  estado: estadoExterno,
  definir: definirExterno,
}: {
  estado?: EstadoExecucao;
  definir?: (patch: Partial<EstadoExecucao>, modo?: 'replace' | 'push') => void;
} = {}) {
  const interno = useEstadoExecucao();
  const estado = estadoExterno ?? interno.estado;
  const definir = definirExterno ?? interno.definir;
  const router = useRouter();
  const empurrou = useRef(false);
  const [data, setData] = useState<TarefasExecucaoResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const status = estado.status;
  const atribuidaAMim = estado.atribuidaAMim;
  const minhasEquipes = estado.minhasEquipes;
  const atrasadas = estado.atrasadas;
  const historico = estado.historico;
  const prazoFrom = estado.prazoDe;
  const prazoTo = estado.prazoAte;
  const secretariaId = estado.secretaria;
  const equipeId = estado.equipeTarefa;
  const responsavelId = estado.responsavelTarefa;
  const tipoChamadoId = estado.tipo;
  const prioridade = estado.prioridade;
  const [secretarias, setSecretarias] = useState<Array<{ id: string; nome: string; sigla: string }>>([]);
  const [equipes, setEquipes] = useState<Array<{ id: string; nome: string }>>([]);
  const [responsaveis, setResponsaveis] = useState<Array<{ id: string; nome: string }>>([]);
  const [tipos, setTipos] = useState<Array<{ id: string; nome: string }>>([]);
  const aberta = estado.tarefa;
  const [semAcesso, setSemAcesso] = useState(false);
  // 286: no celular a aba abre em Lista (decisão 14/10).
  const mobile = estado.painelTarefas;
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState(estado.search);
  const [selecionada, setSelecionada] = useState<string | null>(estado.tarefa);
  const [destacadas, setDestacadas] = useState<string[]>([]);
  const [hovered, setHovered] = useState<string | null>(null);
  const [rolarParaSelecionada, setRolarParaSelecionada] = useState(0);
  const [anuncio, setAnuncio] = useState('');
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  function carregar() {
    setErro(null);
    setCarregando(true);
    listTarefasExecucao(
      montarParametrosTarefasExecucao({
        status,
        atribuidaAMim,
        minhasEquipes,
        atrasadas,
        historico,
        prazoFrom,
        prazoTo,
        secretariaId,
        equipeId,
        responsavelId,
        tipoChamadoId,
        prioridade,
      }),
    )
      .then(setData)
      .catch((err) => setErro(err instanceof Error ? err.message : 'Falha ao carregar tarefas.'))
      .finally(() => setCarregando(false));
  }

  function limparFiltros() {
    setBusca('');
    definir({
      status: '',
      atribuidaAMim: false,
      minhasEquipes: false,
      atrasadas: false,
      historico: false,
      prazoDe: '',
      prazoAte: '',
      secretaria: '',
      equipeTarefa: '',
      responsavelTarefa: '',
      tipo: '',
      prioridade: '',
      search: '',
    });
  }

  /** 286: clique no pin só seleciona (não abre o modal), rola a lista e anuncia. */
  function selecionarPeloPin(pinId: string) {
    const pin = pins.find((item) => item.id === pinId);
    const ids = pin?.tarefaIds ?? [pinId];
    const id = ids[0];
    setSelecionada(id);
    setDestacadas(ids.length > 1 ? ids : []);
    setRolarParaSelecionada((n) => n + 1);
    const tarefa = data?.items.find((item) => item.id === id);
    setAnuncio(
      ids.length > 1
        ? `${ids.length} tarefas neste local selecionadas no mapa`
        : tarefa
          ? `Tarefa ${tarefa.titulo} selecionada no mapa`
          : '',
    );
  }

  /** 286: card/Enter/Espaço seleciona, abre o modal e lembra o card para devolver o foco. */
  function abrirTarefa(id: string) {
    setSelecionada(id);
    setDestacadas([]);
    setSemAcesso(false);
    const modo = detalheCobreLista() ? 'push' : 'replace';
    empurrou.current = modo === 'push';
    definir({ tarefa: id }, modo);
  }

  function fecharTarefa() {
    const id = aberta;
    setSemAcesso(false);
    if (empurrou.current) {
      empurrou.current = false;
      router.back();
    } else if (estado.tarefa) {
      definir({ tarefa: null });
    }
    if (id && typeof document !== 'undefined') {
      requestAnimationFrame(() => {
        const card = document.querySelector<HTMLButtonElement>(`[data-tarefa-id="${CSS.escape(id)}"]`);
        card?.focus();
      });
    }
  }

  useEffect(() => {
    setBusca(estado.search);
  }, [estado.search]);

  useEffect(() => {
    setSemAcesso(false);
  }, [estado.tarefa]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (busca !== estado.search) definir({ search: busca });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [busca, estado.search, definir]);

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

  useEffect(() => {
    const patch: Partial<EstadoExecucao> = {};
    if (secretarias.length && secretariaId && !secretarias.some((item) => item.id === secretariaId)) patch.secretaria = '';
    if (equipes.length && equipeId && !equipes.some((item) => item.id === equipeId)) patch.equipeTarefa = '';
    if (responsaveis.length && responsavelId && !responsaveis.some((item) => item.id === responsavelId)) patch.responsavelTarefa = '';
    if (tipos.length && tipoChamadoId && !tipos.some((item) => item.id === tipoChamadoId)) patch.tipo = '';
    if (Object.keys(patch).length) definir(patch);
  }, [secretarias, equipes, responsaveis, tipos, secretariaId, equipeId, responsavelId, tipoChamadoId, definir]);

  const visiveis = useMemo(() => filtrarTarefasBusca(data?.items ?? [], busca), [data, busca]);
  // 286: um pin por ponto, com contador; a busca local também filtra os pins.
  const pins = useMemo(() => agruparPinsTarefas(visiveis), [visiveis]);
  const pinSelecionado = pinDaTarefa(pins, selecionada);
  const pinHover = pinDaTarefa(pins, hovered);

  useEffect(() => {
    if (!aberta || typeof window === 'undefined') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') fecharTarefa();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta]);

  const filtrosResumo = useMemo(() => {
    const secretaria = secretarias.find((item) => item.id === secretariaId);
    const equipe = equipes.find((item) => item.id === equipeId);
    const responsavel = responsaveis.find((item) => item.id === responsavelId);
    const tipo = tipos.find((item) => item.id === tipoChamadoId);
    return {
      status,
      historico,
      secretariaSigla: secretaria?.sigla,
      equipeNome: equipe?.nome,
      responsavelNome: responsavel?.nome,
      tipoNome: tipo?.nome,
      prioridade,
      atribuidaAMim,
      minhasEquipes,
      atrasadas,
      prazoFrom,
      prazoTo,
    };
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
  const resumoFiltros = resumoFiltrosTarefasExecucao(filtrosResumo);
  const contagemFiltros = rotuloContagemFiltros(contarFiltrosAtivosTarefas(filtrosResumo));

  const campo = 'h-9 w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-2 text-[12px]';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Badge variant="neutral">{data?.contadores.novas ?? 0} novas</Badge>
        <Badge variant="warning" className="text-[var(--warn-ink)]">{data?.contadores.emAndamento ?? 0} em andamento</Badge>
        <Badge variant="danger" className="text-[var(--danger-ink)]">{data?.contadores.atrasadas ?? 0} atrasadas</Badge>
      </div>
      <div className="overflow-hidden rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)]">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left"
          onClick={() => setFiltrosAbertos((current) => !current)}
          aria-expanded={filtrosAbertos}
        >
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[var(--ink)]">
              Filtros de tarefas
              {contagemFiltros ? <span data-testid="contagem-filtros-tarefas"> {contagemFiltros}</span> : null}
            </p>
            {!filtrosAbertos ? (
              <p className="mt-0.5 line-clamp-2 text-[11px] text-[var(--ink-3)]" title={resumoFiltros}>
                {resumoFiltros}
              </p>
            ) : null}
          </div>
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-[var(--ink-3)] transition-transform', filtrosAbertos ? 'rotate-180' : '')} />
        </button>
        {filtrosAbertos ? (
          <div className="space-y-3 border-t border-[var(--line-2)] px-3.5 py-3.5">
            <div className="flex flex-wrap gap-1.5">
              <Chip active={atribuidaAMim} onClick={() => definir({ atribuidaAMim: !atribuidaAMim })}>
                Atribuídas a mim
              </Chip>
              <Chip active={minhasEquipes} onClick={() => definir({ minhasEquipes: !minhasEquipes })}>
                Minhas equipes
              </Chip>
              <Chip active={atrasadas} onClick={() => definir({ atrasadas: !atrasadas })}>
                Atrasadas
              </Chip>
              <Chip active={historico} onClick={() => definir({ historico: !historico })}>
                Histórico
              </Chip>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <FiltroRotulo label="Status">
                <select value={status} onChange={(event) => definir({ status: event.target.value as EstadoExecucao['status'] })} className={campo}>
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
                <select value={secretariaId} onChange={(event) => definir({ secretaria: event.target.value })} className={campo}>
                  <option value="">Todas</option>
                  {secretarias.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.sigla}
                    </option>
                  ))}
                </select>
              </FiltroRotulo>
              <FiltroRotulo label="Equipe">
                <select value={equipeId} onChange={(event) => definir({ equipeTarefa: event.target.value })} className={campo}>
                  <option value="">Todas</option>
                  {equipes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome}
                    </option>
                  ))}
                </select>
              </FiltroRotulo>
              <FiltroRotulo label="Responsável">
                <select value={responsavelId} onChange={(event) => definir({ responsavelTarefa: event.target.value })} className={campo}>
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
                <select value={tipoChamadoId} onChange={(event) => definir({ tipo: event.target.value })} className={campo}>
                  <option value="">Todos</option>
                  {tipos.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome}
                    </option>
                  ))}
                </select>
              </FiltroRotulo>
              <FiltroRotulo label="Prioridade">
                <select value={prioridade} onChange={(event) => definir({ prioridade: event.target.value as EstadoExecucao['prioridade'] })} className={campo}>
                  <option value="">Todas</option>
                  {Object.entries(TAREFA_PRIORIDADE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </FiltroRotulo>
              <FiltroRotulo label="Prazo de">
                <input type="date" value={prazoFrom} onChange={(event) => definir({ prazoDe: event.target.value })} className={campo} />
              </FiltroRotulo>
              <FiltroRotulo label="Prazo até">
                <input type="date" value={prazoTo} onChange={(event) => definir({ prazoAte: event.target.value })} className={campo} />
              </FiltroRotulo>
            </div>
            <Button type="button" variant="outlined" size="sm" onClick={limparFiltros}>
              Limpar filtros
            </Button>
          </div>
        ) : null}
      </div>
      <div className="flex gap-2 xl:hidden">
        <Chip active={mobile === 'lista'} onClick={() => definir({ painelTarefas: 'lista' })} className="min-h-11">
          Lista
        </Chip>
        <Chip active={mobile === 'mapa'} onClick={() => definir({ painelTarefas: 'mapa' })} className="min-h-11">
          Mapa
        </Chip>
      </div>
      <p className="sr-only" aria-live="polite" data-tarefas-anuncio>
        {anuncio}
      </p>
      <div className="tarefas-workspace cco-workspace grid min-h-0 min-w-0 gap-3 xl:grid-cols-[minmax(300px,360px)_minmax(0,1fr)] xl:items-stretch">
        <section
          aria-label="Fila de tarefas"
          className={`cco-list-panel min-h-0 min-w-0 flex-col overflow-hidden rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--sh-sm)] ${mobile === 'lista' ? 'flex' : 'hidden xl:flex'}`}
        >
          <div className="shrink-0 border-b border-[var(--line-2)] px-3.5 py-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-[var(--ink)]">Fila de tarefas</span>
              <span className="text-[12px] text-[var(--ink-3)]" data-tarefas-no-mapa={pins.length}>
                {pins.length} no mapa
              </span>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--ink-3)]" aria-hidden />
              <input
                type="search"
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                aria-label="Buscar tarefa"
                placeholder="Buscar tarefa, chamado, equipe…"
                className="h-11 w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] pr-3 pl-9 text-[13px] focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brand-soft)] focus:outline-none xl:h-[38px]"
              />
            </div>
          </div>
          <div className="tarefas-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))] xl:pb-0">
            <FilaTarefasConteudo
              estado={estadoFila({ carregando: carregando && !data, erro, total: visiveis.length })}
              erro={erro}
              busca={busca}
              onRetry={carregar}
              onLimpar={limparFiltros}
            >
              <TarefasExecucaoList
                tarefas={visiveis}
                selectedId={selecionada}
                destacadas={destacadas}
                hoveredId={hovered}
                onOpen={abrirTarefa}
                onHover={setHovered}
                rolarParaSelecionada={rolarParaSelecionada}
              />
            </FilaTarefasConteudo>
          </div>
        </section>
        <div className={`cco-map-host min-h-0 min-w-0 flex-col overflow-hidden ${mobile === 'mapa' ? 'flex' : 'hidden xl:flex'}`}>
          <div className="mb-2 hidden shrink-0 items-center gap-2 xl:flex">
            <span className="text-[13px] font-semibold text-[var(--ink)]">Mapa de tarefas</span>
            <span className="text-[12px] text-[var(--ink-2)]">— clique no pin para selecionar</span>
          </div>
          <section className="cco-map-panel min-h-[320px] flex-1 overflow-hidden xl:min-h-0">
            <ChamadosExecucaoMap
              pontos={erro ? [] : pins}
              selectedId={pinSelecionado}
              hoveredId={pinHover}
              onSelect={selecionarPeloPin}
              onClearSelection={() => {
                setSelecionada(null);
                setDestacadas([]);
              }}
              onPopupAction={(pinId) => abrirTarefa(pins.find((pin) => pin.id === pinId)?.tarefaIds[0] ?? pinId)}
              popupActionLabel="Abrir tarefa"
              popupActionKind="modal"
            />
          </section>
        </div>
      </div>
      {semAcesso && aberta ? (
        <div role="status" data-testid="aviso-registro-url" className="flex items-center justify-between gap-3 rounded-[var(--r-md)] border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-[13px] text-amber-950">{AVISO_REGISTRO_URL}</p>
          <button type="button" className="text-[13px] font-semibold text-amber-950" onClick={fecharTarefa}>
            Fechar
          </button>
        </div>
      ) : null}
      <ChamadoTarefaSheet
        tarefaId={semAcesso ? null : aberta}
        onClose={fecharTarefa}
        onChanged={carregar}
        onSemAcesso={() => setSemAcesso(true)}
      />
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

export type EstadoFilaTarefas = 'carregando' | 'erro' | 'vazia' | 'lista';

/** 286 §7: qual estado a fila mostra (dentro do painel). */
export function estadoFila({ carregando, erro, total }: { carregando: boolean; erro: string | null; total: number }): EstadoFilaTarefas {
  if (erro) return 'erro';
  if (carregando) return 'carregando';
  return total === 0 ? 'vazia' : 'lista';
}

export function FilaTarefasConteudo({
  estado,
  erro,
  busca,
  onRetry,
  onLimpar,
  children,
}: {
  estado: EstadoFilaTarefas;
  erro: string | null;
  busca: string;
  onRetry: () => void;
  onLimpar: () => void;
  children: ReactNode;
}) {
  if (estado === 'carregando') {
    return (
      <div className="space-y-3 p-3.5" aria-busy="true" aria-label="Carregando tarefas" data-fila-estado="carregando">
        {[0, 1, 2].map((n) => (
          <div key={n} className="space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>
    );
  }
  if (estado === 'erro') {
    return (
      <div className="p-3.5" data-fila-estado="erro">
        <ErrorState message={erro ?? 'Falha ao carregar tarefas.'} onRetry={onRetry} />
      </div>
    );
  }
  if (estado === 'vazia') {
    const termo = busca.trim();
    return (
      <div className="flex flex-col items-center px-6 py-10 text-center" data-fila-estado="vazia">
        <ListX className="mb-2 h-8 w-8 text-[var(--ink-3)]" aria-hidden />
        <p className="text-[14px] font-semibold text-[var(--ink)]">
          {termo ? `Nenhuma tarefa encontrada para '${termo}'` : 'Nenhuma tarefa neste filtro'}
        </p>
        <Button type="button" variant="outlined" size="sm" className="mt-3 min-h-11 xl:min-h-8" onClick={onLimpar}>
          Limpar filtros
        </Button>
      </div>
    );
  }
  return <>{children}</>;
}
