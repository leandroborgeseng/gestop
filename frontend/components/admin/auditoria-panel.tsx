'use client';

import { useEffect, useMemo, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ErrorState, LoadingState } from '@/components/ui-states';
import { useSessionUser } from '@/components/auth/session-context';
import { getAdminAuditoriaConfig, listAdminAuditoriaLogs, saveAdminAuditoriaConfig } from '@/lib/api';
import { hasAdminTabAccess } from '@/lib/permissions-matrix';
import { ListPagination } from '@/components/ui/list-pagination';

type ConfigResponse = Awaited<ReturnType<typeof getAdminAuditoriaConfig>>;
type LogsResponse = Awaited<ReturnType<typeof listAdminAuditoriaLogs>>;

export function AuditoriaPanel() {
  const user = useSessionUser();
  const canConfig = hasAdminTabAccess('auditoria', 'alterar', user?.permissoes ?? [])
    || hasAdminTabAccess('auditoria', 'executar', user?.permissoes ?? []);
  const [tab, setTab] = useState<'consulta' | 'config'>('consulta');
  const [logs, setLogs] = useState<LogsResponse | null>(null);
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [usuarioId, setUsuarioId] = useState('');
  const [acao, setAcao] = useState('');
  const [tela, setTela] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  async function loadLogs(nextPage = page, nextSize = pageSize) {
    setLoading(true);
    setError(null);
    try {
      const data = await listAdminAuditoriaLogs({
        from: from || undefined,
        to: to || undefined,
        usuarioId: usuarioId || undefined,
        acao: acao || undefined,
        tela: tela || undefined,
        search: search || undefined,
        limit: nextSize,
        offset: (nextPage - 1) * nextSize,
      });
      setLogs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar logs.');
    } finally {
      setLoading(false);
    }
  }

  async function loadConfig() {
    try {
      setConfig(await getAdminAuditoriaConfig());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar configuração.');
    }
  }

  useEffect(() => {
    void loadLogs(1, pageSize);
    void loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const eventos = useMemo(() => config?.eventos ?? [], [config]);

  async function toggleEvento(telaId: string, funcaoId: string, acaoId: string, chave: string, ativo: boolean) {
    if (!canConfig) return;
    await saveAdminAuditoriaConfig({ chave, telaId, funcaoId, acao: acaoId, ativo });
    await loadConfig();
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant={tab === 'consulta' ? 'filled' : 'outlined'} onClick={() => setTab('consulta')}>
          Consulta
        </Button>
        <Button type="button" size="sm" variant={tab === 'config' ? 'filled' : 'outlined'} onClick={() => setTab('config')}>
          Configuração
        </Button>
      </div>

      {error ? <ErrorState message={error} onRetry={() => void loadLogs()} /> : null}

      {tab === 'consulta' ? (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="De">
              <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </Field>
            <Field label="Até">
              <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </Field>
            <Field label="Usuário">
              <Select value={usuarioId} onChange={(event) => setUsuarioId(event.target.value)}>
                <option value="">Todos</option>
                {(config?.usuarios ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tipo de evento">
              <Select value={acao} onChange={(event) => setAcao(event.target.value)}>
                <option value="">Todos</option>
                {eventos.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tela" className="sm:col-span-2">
              <Select value={tela} onChange={(event) => setTela(event.target.value)}>
                <option value="">Todas</option>
                {(config?.telas ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Pesquisa livre" className="sm:col-span-2">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar em descrição, usuário, IP..." />
            </Field>
          </div>
          <Button type="button" size="sm" onClick={() => { setPage(1); void loadLogs(1, pageSize); }}>
            Filtrar
          </Button>
          {loading && !logs ? <LoadingState label="Carregando logs..." /> : null}
          {logs ? (
            <>
              <ListPagination
                page={page}
                pageSize={pageSize}
                total={logs.total}
                onPageChange={(next) => {
                  setPage(next);
                  void loadLogs(next, pageSize);
                }}
                onPageSizeChange={(size) => {
                  const nextSize = size === 'TODOS' ? Math.min(logs.total || 50, 200) : size;
                  setPageSize(nextSize);
                  setPage(1);
                  void loadLogs(1, nextSize);
                }}
              />
              <div className="max-h-[560px] space-y-2 overflow-y-auto">
                {logs.items.length === 0 ? (
                  <p className="py-6 text-center text-[13px] text-[var(--ink-3)]">Nenhum log encontrado.</p>
                ) : (
                  logs.items.map((item) => (
                    <article key={item.id} className="rounded-[var(--r-md)] border border-[var(--line)] p-3">
                      <div className="flex flex-wrap items-center gap-2 text-[13px]">
                        <ScrollText className="h-4 w-4 text-[var(--brand)]" />
                        <strong>{item.acao}</strong>
                        <span className="text-[var(--ink-3)]">{item.entidadeTipo}</span>
                        <span className="ml-auto text-[12px] text-[var(--ink-3)]">
                          {new Date(item.createdAt).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <p className="mt-1 text-[13px] text-[var(--ink-2)]">
                        {item.descricao || item.entidadeId || 'Sem descrição'}
                      </p>
                      <p className="mt-1 text-[11px] text-[var(--ink-3)]">
                        {item.usuario?.nome ?? 'Sistema'}
                        {item.perfilAtivoNome ? ` · ${item.perfilAtivoNome}` : ''}
                        {item.secretariaAtivaSigla ? ` · ${item.secretariaAtivaSigla}` : ''}
                        {item.tela ? ` · ${item.tela}` : ''}
                        {item.ip ? ` · ${item.ip}` : ''}
                      </p>
                    </article>
                  ))
                )}
              </div>
            </>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          {!canConfig ? <Alert variant="warning">Você pode consultar os logs, mas não alterar a geração.</Alert> : null}
          <p className="text-[13px] text-[var(--ink-3)]">
            Marque as telas, funções e tipos de evento que devem gerar registro de auditoria. O que o sistema já grava hoje permanece ativo.
          </p>
          <div className="overflow-x-auto rounded-[var(--r-card)] border border-[var(--line)]">
            <table className="min-w-[960px] w-full text-left text-[12px]">
              <thead className="bg-[var(--surface-2)]">
                <tr>
                  <th className="sticky left-0 bg-[var(--surface-2)] px-3 py-2">Tela / função</th>
                  {(config?.eventos ?? []).map((evento) => (
                    <th key={evento.id} className="px-2 py-2 font-semibold">{evento.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(config?.telas ?? []).flatMap((telaItem) =>
                  telaItem.functions.map((funcao) => (
                    <tr key={`${telaItem.id}.${funcao.id}`} className="border-t border-[var(--line)]">
                      <td className="sticky left-0 bg-[var(--surface)] px-3 py-2 font-medium">
                        {telaItem.label}
                        {funcao.id !== '_tela' ? ` · ${funcao.label}` : ''}
                      </td>
                      {funcao.eventos.map((evento) => (
                        <td key={evento.chave} className="px-2 py-2">
                          <input
                            type="checkbox"
                            checked={evento.ativo}
                            disabled={!canConfig}
                            onChange={(change) =>
                              void toggleEvento(telaItem.id, funcao.id, evento.acao, evento.chave, change.target.checked)
                            }
                            aria-label={`${funcao.label} ${evento.label}`}
                          />
                        </td>
                      ))}
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
