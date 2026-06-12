// SIGMA — Ordens de serviço (lista + detalhe com timeline)
const { Icon: OIcon, Button: OButton, Badge: OBadge, Chip: OChip, SearchInput: OSearch, PageShell: OPageShell, Select: OSelect } = window;
const { useState: useStateO } = React;

function prazoTone(d) { return d <= 0 ? "danger" : d <= 2 ? "warn" : "neutral"; }
function prazoLabel(o) {
  if (o.status === "CONCLUIDA") return "Concluída";
  if (o.prazoDias < 0) return `Vencida`;
  if (o.prazoDias === 0) return "Vence hoje";
  return `${o.prazoDias} dia${o.prazoDias > 1 ? "s" : ""}`;
}

function OSTimeline({ o }) {
  const base = [
    { t: "Aberta", d: o.aberta, done: true, sub: o.origem },
    { t: "Triada e priorizada", d: o.aberta, done: true, sub: `Prioridade ${o.prioridade}` },
    { t: "Atribuída", d: o.aberta, done: ["EM_EXECUCAO", "AGUARDANDO", "CONCLUIDA"].includes(o.status), sub: o.responsavel },
    { t: o.status === "AGUARDANDO" ? "Aguardando peça" : "Em execução", d: "—", done: ["EM_EXECUCAO", "AGUARDANDO", "CONCLUIDA"].includes(o.status), active: o.status === "EM_EXECUCAO" || o.status === "AGUARDANDO" },
    { t: "Concluída", d: o.status === "CONCLUIDA" ? o.prazo : "—", done: o.status === "CONCLUIDA" },
  ];
  return (
    <div className="timeline">
      {base.map((s, i) => (
        <div key={i} className={`tl-item ${s.done ? "done" : ""} ${s.active ? "active" : ""}`}>
          <div className="tl-marker">{s.done ? <OIcon name="check" size={12} /> : <span className="tl-dot" />}</div>
          <div className="tl-body">
            <div className="tl-top"><span className="tl-title">{s.t}</span><span className="tl-date mono">{s.d}</span></div>
            {s.sub && <div className="tl-sub">{s.sub}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function OSDetail({ o, onAction }) {
  const { OS_STATUS, PRIOR } = window.SIGMA;
  if (!o) return <div className="card detail-empty"><OIcon name="clipboard" size={30} /><p>Selecione uma OS</p></div>;
  const st = OS_STATUS[o.status];
  return (
    <div className="card chd">
      <div className="chd-head">
        <div className="chd-head-top">
          <span className="drawer-code">{o.codigo}</span>
          <div className="chd-badges">
            <OBadge tone={PRIOR[o.prioridade]}>{o.prioridade}</OBadge>
            <OBadge tone={st.tone}>{st.label}</OBadge>
          </div>
        </div>
        <h2 className="chd-title">{o.titulo}</h2>
        <div className="chd-meta"><span><OIcon name="building" size={13} /> {o.unidade}</span><span className="mono">{o.unidadeCod}</span></div>
      </div>
      <div className="chd-body">
        <div className="os-summary">
          <div className={`os-sum-card tone-${prazoTone(o.prazoDias)}`}>
            <span className="os-sum-l">Prazo</span>
            <span className="os-sum-v">{prazoLabel(o)}</span>
            <span className="os-sum-s mono">{o.prazo}</span>
          </div>
          <div className="os-sum-card">
            <span className="os-sum-l">Responsável</span>
            <span className="os-sum-v sm">{o.responsavel}</span>
            <span className="os-sum-s">{o.sec}</span>
          </div>
          <div className="os-sum-card">
            <span className="os-sum-l">Origem</span>
            <span className="os-sum-v sm">{o.origem}</span>
          </div>
        </div>
        <div className="chd-k" style={{ marginBottom: 10 }}>Linha do tempo</div>
        <OSTimeline o={o} />
        <div className="chd-actions">
          {o.status !== "CONCLUIDA" && <OButton variant="filled" icon="refresh" onClick={() => onAction(o, "next")}>Atualizar status</OButton>}
          {o.status !== "CONCLUIDA" && <OButton variant="outlined" icon="checkCircle" onClick={() => onAction(o, "CONCLUIDA")}>Concluir OS</OButton>}
          <OButton variant="ghost" icon="fileText">Ver chamado / NC</OButton>
        </div>
      </div>
    </div>
  );
}

function OrdensServico() {
  const { OS_STATUS, PRIOR, ORDENS } = window.SIGMA;
  const [items, setItems] = useStateO(ORDENS.map((o) => ({ ...o })));
  const [status, setStatus] = useStateO("all");
  const [prio, setPrio] = useStateO("all");
  const [q, setQ] = useStateO("");
  const [sel, setSel] = useStateO(ORDENS[0].codigo);
  const [toast, setToast] = useStateO(null);

  const FLOW = ["ABERTA", "EM_EXECUCAO", "AGUARDANDO", "CONCLUIDA"];
  const act = (o, target) => {
    let next = target;
    if (target === "next") {
      const i = FLOW.indexOf(o.status);
      next = FLOW[Math.min(i + 1, FLOW.length - 1)];
    }
    setItems((arr) => arr.map((x) => x.codigo === o.codigo
      ? { ...x, status: next, prazoDias: next === "CONCLUIDA" ? x.prazoDias : x.prazoDias } : x));
    const lbl = OS_STATUS[next] ? OS_STATUS[next].label : next;
    setToast(`${o.codigo} → ${lbl}`);
    setTimeout(() => setToast(null), 2600);
  };

  const filtered = items.filter((o) => {
    if (status !== "all" && o.status !== status) return false;
    if (prio !== "all" && o.prioridade !== prio) return false;
    if (q && !`${o.titulo} ${o.codigo} ${o.unidade}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const selected = items.find((o) => o.codigo === sel) || filtered[0];
  const chips = [{ id: "all", label: "Todas" }, ...Object.entries(OS_STATUS).map(([k, v]) => ({ id: k, label: v.label }))];

  return (
    <OPageShell kicker="Manutenção" title="Ordens de serviço"
      description="Acompanhamento de OS com prazo, responsável e linha do tempo de execução."
      actions={<OButton variant="filled" icon="plus">Nova OS</OButton>}>

      <div className="os-toolbar">
        <div className="situ-chips">
          {chips.map((c) => <OChip key={c.id} active={status === c.id} onClick={() => setStatus(c.id)}>{c.label}</OChip>)}
        </div>
        <div className="os-toolbar-right">
          <OSelect value={prio} onChange={setPrio} options={[{ value: "all", label: "Todas prioridades" }, ...Object.keys(PRIOR).map((p) => ({ value: p, label: p }))]} />
        </div>
      </div>

      <div className="chamados-grid">
        <section className="card cco-list-panel">
          <div className="filters" style={{ borderBottom: "1px solid var(--line-2)" }}>
            <OSearch value={q} onChange={setQ} placeholder="Buscar OS, unidade…" />
          </div>
          <div className="unit-list">
            {filtered.map((o) => {
              const st = OS_STATUS[o.status];
              return (
                <button key={o.codigo} className={`ch-row ${selected && selected.codigo === o.codigo ? "is-selected" : ""}`} onClick={() => setSel(o.codigo)}>
                  <div className="ch-row-top">
                    <span className="unit-code">{o.codigo}</span>
                    <OBadge tone={PRIOR[o.prioridade]}>{o.prioridade}</OBadge>
                  </div>
                  <div className="unit-name">{o.titulo}</div>
                  <div className="unit-meta"><span>{o.unidade}</span></div>
                  <div className="ch-row-foot">
                    <OBadge tone={st.tone}>{st.label}</OBadge>
                    <span className={`ch-prazo tone-${prazoTone(o.prazoDias)}`}><OIcon name="clock" size={12} /> {prazoLabel(o)}</span>
                    <span className="ch-canal"><OIcon name="user" size={12} /> {o.responsavel}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
        <section className="chamado-detail-panel">
          <OSDetail o={selected} onAction={act} />
        </section>
      </div>
      {toast && <div className="toast"><OIcon name="checkCircle" size={16} /> {toast}</div>}
    </OPageShell>
  );
}

window.OrdensServico = OrdensServico;
