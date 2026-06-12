// SIGMA — Dashboard (visão executiva)
const { Icon: DIcon, Button: DButton, MetricCard: DMetric, PageShell: DPageShell, Badge: DBadge } = window;

function AlertItem({ a }) {
  return (
    <div className="alert-item">
      <div className={`alert-ic ri-${a.tipo === "danger" ? "danger" : a.tipo === "warn" ? "warn" : "info"}`}>
        <DIcon name={a.icon} size={16} />
      </div>
      <div className="alert-main">
        <div className="alert-title">{a.titulo}</div>
        <div className="alert-desc">{a.desc}</div>
      </div>
      <div className="alert-when">{a.quando}</div>
    </div>
  );
}

function Dashboard() {
  const { DASH, ALERTAS, AUDITORIA } = window.SIGMA;
  const links = [
    { id: "cco", icon: "map", label: "Abrir CCO" },
    { id: "chamados", icon: "inbox", label: "Triagem de chamados" },
    { id: "os", icon: "clipboard", label: "Ordens de serviço" },
    { id: "relatorios", icon: "chart", label: "Gerar relatório" },
  ];
  return (
    <DPageShell kicker="Visão executiva" title="Dashboard"
      description="Panorama operacional do dia — Central de Controle, Franca/SP."
      actions={<DButton variant="outlined" icon="download">Exportar resumo</DButton>}>
      <div className="dash-scroll">
        <div className="kpi-row">
          <DMetric icon="inbox" accent="brand" label="Chamados abertos" value={DASH.abertos} delta="+4 hoje" deltaTone="warn" sub="aguardando triagem" />
          <DMetric icon="wrench" accent="info" label="OS em execução" value={DASH.emExec} sub="3 vencem em 48h" />
          <DMetric icon="alert" accent="warn" label="SLA em risco" value={DASH.slaRisco} sub="exigem priorização" />
          <DMetric icon="checkCircle" accent="ok" label="Concluídas no mês" value={DASH.concluidasMes} delta="+12%" deltaTone="ok" sub="vs. abril" />
        </div>

        <div className="dash-grid">
          <section className="card dash-card">
            <div className="panel-head">
              <div className="panel-title"><DIcon name="alert" size={16} /> Alertas operacionais</div>
              <span className="panel-count">{ALERTAS.length}</span>
            </div>
            <div className="alert-list">
              {ALERTAS.map((a, i) => <AlertItem key={i} a={a} />)}
            </div>
          </section>

          <section className="card dash-card">
            <div className="panel-head">
              <div className="panel-title"><DIcon name="bell" size={16} /> Notificações push</div>
              <DBadge tone="ok">PWA ativa</DBadge>
            </div>
            <div className="push-box">
              <div className="push-compose">
                <div className="field-label">Enviar aviso aos agentes de campo</div>
                <textarea className="push-area" placeholder="Ex.: Priorizar fiscalizações da SME até sexta-feira…"></textarea>
                <div className="push-actions">
                  <select className="select"><option>Todos os agentes</option><option>Equipe SME</option><option>Equipe SMS</option></select>
                  <DButton variant="filled" icon="arrowUpRight">Enviar push</DButton>
                </div>
              </div>
              <div className="push-recent">
                <div className="push-recent-item"><span className="online-dot" /> "Reunião de turno 8h" · entregue a 23 agentes · ontem</div>
                <div className="push-recent-item"><span className="online-dot" /> "Atualizar app para v2.4" · entregue a 23 agentes · 2 dias</div>
              </div>
            </div>
          </section>
        </div>

        <div className="dash-grid">
          <section className="card dash-card">
            <div className="panel-head"><div className="panel-title"><DIcon name="clock" size={16} /> Auditoria recente</div></div>
            <div className="audit-list">
              {AUDITORIA.map((x, i) => (
                <div className="audit-row" key={i}>
                  <span className="audit-time mono">{x.quando}</span>
                  <span className="audit-dot" />
                  <span className="audit-text"><b>{x.quem}</b> {x.acao} <span className="audit-alvo mono">{x.alvo}</span></span>
                </div>
              ))}
            </div>
          </section>

          <section className="card dash-card">
            <div className="panel-head"><div className="panel-title"><DIcon name="grid" size={16} /> Links rápidos</div></div>
            <div className="quick-links">
              {links.map((l) => (
                <button key={l.id} className="quick-link" onClick={() => window.__setRoute && window.__setRoute(l.id)}>
                  <div className="quick-ic"><DIcon name={l.icon} size={18} /></div>
                  <span>{l.label}</span>
                  <DIcon name="chevronRight" size={15} className="quick-caret" />
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </DPageShell>
  );
}

window.Dashboard = Dashboard;
