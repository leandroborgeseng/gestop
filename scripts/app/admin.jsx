// SIGMA — Admin, Relatórios, Integrações, Conta
const { Icon: AIcon, Button: AButton, Badge: ABadge, Tabs: ATabs, PageShell: APageShell, Field: AField, Select: ASelect, IconButton: AIconBtn } = window;
const { useState: useStateA2 } = React;

const USUARIOS = [
  { nome: "Ricardo Campos", email: "ricardo.campos@franca.sp.gov.br", perfil: "Gestor CCO", sec: "SEMAD", status: "Ativo" },
  { nome: "Marcos A. Pereira", email: "marcos.pereira@franca.sp.gov.br", perfil: "Agente de Campo", sec: "SME", status: "Ativo" },
  { nome: "Ana P. Lima", email: "ana.lima@franca.sp.gov.br", perfil: "Agente de Campo", sec: "SME", status: "Ativo" },
  { nome: "Paulo R. Dias", email: "paulo.dias@franca.sp.gov.br", perfil: "Operador Manutenção", sec: "SMS", status: "Ativo" },
  { nome: "Beatriz O. Ramos", email: "beatriz.ramos@franca.sp.gov.br", perfil: "Administrador", sec: "SMC", status: "Inativo" },
];

function AdminTable({ tab }) {
  const { SECRETARIAS, UNIDADES } = window.SIGMA;
  if (tab === "sec") return (
    <table className="tbl">
      <thead><tr><th>Sigla</th><th>Secretaria</th><th>Próprios</th><th className="ta-r">Ações</th></tr></thead>
      <tbody>
        {SECRETARIAS.map((s) => (
          <tr key={s.id}>
            <td className="mono">{s.id}</td><td>{s.full}</td>
            <td className="mono">{UNIDADES.filter((u) => u.secretaria === s.id).length}</td>
            <td className="ta-r"><AIconBtn icon="settings" label="Editar" /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  if (tab === "uni") return (
    <table className="tbl">
      <thead><tr><th>Código</th><th>Unidade</th><th>Tipo</th><th>Secretaria</th><th>Situação</th><th className="ta-r">Ações</th></tr></thead>
      <tbody>
        {UNIDADES.slice(0, 10).map((u) => (
          <tr key={u.id}>
            <td className="mono">{u.codigo}</td><td>{u.nome}</td><td>{u.tipo}</td><td className="mono">{u.secretaria}</td>
            <td><window.StatusBadge situacao={u.situacao} size="sm" /></td>
            <td className="ta-r"><AIconBtn icon="settings" label="Editar" /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  return (
    <table className="tbl">
      <thead><tr><th>Usuário</th><th>Perfil</th><th>Secretaria</th><th>Status</th><th className="ta-r">Ações</th></tr></thead>
      <tbody>
        {USUARIOS.map((u, i) => (
          <tr key={i}>
            <td><div className="tbl-user"><span className="avatar">{u.nome.split(" ").map((x) => x[0]).slice(0, 2).join("")}</span><div><div className="tbl-user-name">{u.nome}</div><div className="tbl-user-mail">{u.email}</div></div></div></td>
            <td>{u.perfil}</td><td className="mono">{u.sec}</td>
            <td><ABadge tone={u.status === "Ativo" ? "ok" : "neutral"}>{u.status}</ABadge></td>
            <td className="ta-r"><AIconBtn icon="settings" label="Editar" /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Admin() {
  const [tab, setTab] = useStateA2("uni");
  const { SECRETARIAS, UNIDADES } = window.SIGMA;
  const tabs = [
    { id: "sec", label: "Secretarias", count: SECRETARIAS.length },
    { id: "uni", label: "Unidades", count: UNIDADES.length },
    { id: "usr", label: "Usuários", count: USUARIOS.length },
  ];
  return (
    <APageShell kicker="Administração" title="Cadastros e acesso"
      description="Gestão de secretarias, próprios e usuários — com controles de LGPD."
      actions={<AButton variant="filled" icon="plus">Novo registro</AButton>}>
      <div className="dash-scroll">
        <div className="card admin-card">
          <div className="admin-tabs"><ATabs tabs={tabs} active={tab} onChange={setTab} /></div>
          <div className="tbl-wrap"><AdminTable tab={tab} /></div>
        </div>

        <div className="card lgpd-card">
          <div className="lgpd-head"><div className="alert-ic ri-warn"><AIcon name="shield" size={16} /></div>
            <div><div className="lgpd-title">Proteção de dados (LGPD)</div><div className="lgpd-sub">Ações sensíveis — registradas na auditoria.</div></div>
          </div>
          <div className="lgpd-actions">
            <AButton variant="outlined" icon="user">Anonimizar solicitante</AButton>
            <AButton variant="outlined" icon="fileText">Exportar dados pessoais</AButton>
            <AButton variant="danger" icon="x">Expurgar auditoria antiga</AButton>
          </div>
        </div>
      </div>
    </APageShell>
  );
}

function Relatorios() {
  const tipos = [
    { id: "uni", icon: "building", nome: "Próprios públicos", desc: "Cadastro, situação e localização das 165 unidades." },
    { id: "fisc", icon: "clipboard", nome: "Fiscalizações", desc: "Checklists aplicados, conformidade e não conformidades." },
    { id: "os", icon: "wrench", nome: "Ordens de serviço", desc: "Abertas, em execução, concluídas e prazos (SLA)." },
    { id: "ch", icon: "inbox", nome: "Chamados", desc: "Volume por canal, status e tempo de atendimento." },
  ];
  const recentes = [
    { nome: "Fiscalizações — Maio/2026", fmt: "PDF", quando: "31/05 09:10", tam: "1,2 MB" },
    { nome: "Próprios por secretaria", fmt: "CSV", quando: "30/05 16:42", tam: "84 KB" },
    { nome: "OS concluídas — Abril", fmt: "PDF", quando: "02/05 11:20", tam: "960 KB" },
  ];
  return (
    <APageShell kicker="Inteligência operacional" title="Relatórios"
      description="Exportações por tipo e período — CSV para análise, PDF para registro oficial.">
      <div className="dash-scroll">
        <div className="card rep-filters">
          <AField label="Período"><ASelect value="mes" onChange={() => {}} options={[{ value: "mes", label: "Maio/2026" }, { value: "tri", label: "Último trimestre" }, { value: "ano", label: "2026" }]} /></AField>
          <AField label="Secretaria"><ASelect value="all" onChange={() => {}} options={[{ value: "all", label: "Todas" }, ...window.SIGMA.SECRETARIAS.map((s) => ({ value: s.id, label: s.nome }))]} /></AField>
          <AField label="Formato"><ASelect value="pdf" onChange={() => {}} options={[{ value: "pdf", label: "PDF (registro)" }, { value: "csv", label: "CSV (análise)" }]} /></AField>
        </div>
        <div className="rep-grid">
          {tipos.map((t) => (
            <div className="card rep-card" key={t.id}>
              <div className="rep-ic"><AIcon name={t.icon} size={20} /></div>
              <div className="rep-body"><div className="rep-name">{t.nome}</div><div className="rep-desc">{t.desc}</div></div>
              <div className="rep-actions"><AButton variant="outlined" size="sm" icon="download">CSV</AButton><AButton variant="filled" size="sm" icon="fileText">PDF</AButton></div>
            </div>
          ))}
        </div>
        <div className="card dash-card">
          <div className="panel-head"><div className="panel-title"><AIcon name="clock" size={16} /> Exportações recentes</div></div>
          <table className="tbl">
            <thead><tr><th>Relatório</th><th>Formato</th><th>Gerado</th><th>Tamanho</th><th className="ta-r"></th></tr></thead>
            <tbody>{recentes.map((r, i) => (
              <tr key={i}><td>{r.nome}</td><td><ABadge tone={r.fmt === "PDF" ? "danger" : "info"}>{r.fmt}</ABadge></td><td className="mono">{r.quando}</td><td className="mono">{r.tam}</td><td className="ta-r"><AIconBtn icon="download" label="Baixar" /></td></tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </APageShell>
  );
}

function Integracoes() {
  const { INTEGRACOES, EVENTOS } = window.SIGMA;
  return (
    <APageShell kicker="Técnico" title="Integrações"
      description="Webhooks, sincronização de campo e status dos serviços conectados."
      actions={<AButton variant="outlined" icon="refresh">Reprocessar fila</AButton>}>
      <div className="dash-scroll">
        <div className="integ-grid">
          {INTEGRACOES.map((it, i) => (
            <div className="card integ-card" key={i}>
              <div className="integ-top">
                <span className={`integ-status status-${it.status === "ok" ? "ok" : "warn"}`}><span className="status-dot" />{it.status === "ok" ? "Operacional" : "Atenção"}</span>
                {it.status === "warn" && <AButton variant="tonal" size="sm" icon="refresh">Retry</AButton>}
              </div>
              <div className="integ-name">{it.nome}</div>
              <div className="integ-desc">{it.desc}</div>
              <div className="integ-foot"><span>Último evento: <b className="mono">{it.ultimo}</b></span><span className="mono">{it.eventos} eventos</span></div>
            </div>
          ))}
        </div>
        <div className="card dash-card">
          <div className="panel-head"><div className="panel-title"><AIcon name="layers" size={16} /> Log de eventos</div></div>
          <table className="tbl">
            <thead><tr><th>Hora</th><th>Evento</th><th>Payload</th><th>Status</th></tr></thead>
            <tbody>{EVENTOS.map((e, i) => (
              <tr key={i}><td className="mono">{e.hora}</td><td className="mono">{e.tipo}</td><td>{e.payload}</td><td><ABadge tone={e.status.includes("OK") ? "ok" : "warn"}>{e.status}</ABadge></td></tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </APageShell>
  );
}

function Conta() {
  return (
    <APageShell kicker="Perfil" title="Minha conta"
      description="Dados de acesso, segurança e sessões ativas.">
      <div className="dash-scroll conta-scroll">
        <div className="card conta-profile">
          <span className="avatar avatar-lg">RC</span>
          <div><div className="conta-name">Ricardo Campos</div><div className="conta-role">Gestor CCO · SEMAD</div><div className="conta-mail">ricardo.campos@franca.sp.gov.br</div></div>
        </div>
        <div className="card conta-form">
          <div className="conta-form-title">Alterar senha</div>
          <AField label="Senha atual"><input className="select" type="password" placeholder="••••••••" /></AField>
          <AField label="Nova senha" hint="Mínimo 8 caracteres, com número e símbolo."><input className="select" type="password" placeholder="••••••••" /></AField>
          <AField label="Confirmar nova senha"><input className="select" type="password" placeholder="••••••••" /></AField>
          <div style={{ marginTop: 14 }}><AButton variant="filled" icon="check">Salvar nova senha</AButton></div>
        </div>
        <div className="card dash-card">
          <div className="panel-head"><div className="panel-title"><AIcon name="shield" size={16} /> Sessões ativas</div></div>
          <div className="sessoes">
            <div className="sessao"><div className="alert-ic ri-info"><AIcon name="grid" size={15} /></div><div className="alert-main"><div className="alert-title">Navegador — Chrome / Windows</div><div className="alert-desc">Franca, SP · sessão atual</div></div><ABadge tone="ok">Atual</ABadge></div>
            <div className="sessao"><div className="alert-ic ri-muted"><AIcon name="smartphone" size={15} /></div><div className="alert-main"><div className="alert-title">App de campo — Android</div><div className="alert-desc">Última atividade há 2 h</div></div><AButton variant="ghost" size="sm">Encerrar</AButton></div>
          </div>
        </div>
      </div>
    </APageShell>
  );
}

Object.assign(window, { Admin, Relatorios, Integracoes, Conta });
