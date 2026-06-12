// SIGMA — Chamados (triagem)
const { Icon: CIcon, Button: CButton, Badge: CBadge, Chip: CChip, SearchInput: CSearch, PageShell: CPageShell, IconButton: CIconBtn } = window;
const { useState: useStateC, useMemo: useMemoC } = React;

function ChamadoDetail({ ch, onAction }) {
  const { CHAMADO_STATUS, PRIOR } = window.SIGMA;
  if (!ch) return (
    <div className="card detail-empty">
      <CIcon name="inbox" size={30} />
      <p>Selecione um chamado</p>
      <span>Escolha um item da lista para ver detalhes e agir.</span>
    </div>
  );
  const st = CHAMADO_STATUS[ch.status];
  return (
    <div className="card chd">
      <div className="chd-head">
        <div className="chd-head-top">
          <span className="drawer-code">{ch.codigo}</span>
          <div className="chd-badges">
            <CBadge tone={PRIOR[ch.prioridade]}>{ch.prioridade}</CBadge>
            <CBadge tone={st.tone}>{st.label}</CBadge>
          </div>
        </div>
        <h2 className="chd-title">{ch.titulo}</h2>
        <div className="chd-meta">
          <span><CIcon name="building" size={13} /> {ch.unidade}</span>
          <span className="mono">{ch.unidadeCod}</span>
        </div>
      </div>
      <div className="chd-body">
        <div className="chd-grid">
          <div><span className="chd-k">Canal</span><span className="chd-v"><CIcon name={ch.canal === "QR" ? "crosshair" : ch.canal === "App" ? "smartphone" : "bell"} size={13} /> {ch.canal}</span></div>
          <div><span className="chd-k">Aberto em</span><span className="chd-v">{ch.aberto}</span></div>
          <div><span className="chd-k">Bairro</span><span className="chd-v">{ch.bairro}</span></div>
          <div><span className="chd-k">Solicitante</span><span className="chd-v">{ch.solicitante}</span></div>
        </div>
        <div className="chd-desc">
          <span className="chd-k">Descrição</span>
          <p>{ch.desc}</p>
        </div>
        <div className="chd-actions">
          {ch.status === "ABERTO" && <CButton variant="filled" icon="filter" onClick={() => onAction(ch, "EM_TRIAGEM")}>Iniciar triagem</CButton>}
          {(ch.status === "ABERTO" || ch.status === "EM_TRIAGEM") && <CButton variant="tonal" icon="wrench" onClick={() => onAction(ch, "ENCAMINHADO")}>Encaminhar para OS</CButton>}
          {ch.status !== "RESOLVIDO" && ch.status !== "CANCELADO" && <CButton variant="outlined" icon="checkCircle" onClick={() => onAction(ch, "RESOLVIDO")}>Resolver</CButton>}
          {ch.status !== "CANCELADO" && ch.status !== "RESOLVIDO" && <CButton variant="ghost" icon="x" onClick={() => onAction(ch, "CANCELADO")}>Cancelar</CButton>}
        </div>
      </div>
    </div>
  );
}

function Chamados() {
  const { CHAMADO_STATUS, PRIOR } = window.SIGMA;
  const [items, setItems] = useStateC(window.SIGMA.CHAMADOS.map((c) => ({ ...c })));
  const [status, setStatus] = useStateC("all");
  const [q, setQ] = useStateC("");
  const [sel, setSel] = useStateC(items[0].codigo);
  const [toast, setToast] = useStateC(null);

  const counts = useMemoC(() => {
    const c = { all: items.length };
    Object.keys(CHAMADO_STATUS).forEach((k) => { c[k] = items.filter((x) => x.status === k).length; });
    return c;
  }, [items]);

  const filtered = items.filter((c) => {
    if (status !== "all" && c.status !== status) return false;
    if (q && !`${c.titulo} ${c.codigo} ${c.unidade}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const selected = items.find((c) => c.codigo === sel) || filtered[0];

  const act = (ch, newStatus) => {
    setItems((arr) => arr.map((x) => x.codigo === ch.codigo ? { ...x, status: newStatus } : x));
    const labels = { EM_TRIAGEM: "movido para triagem", ENCAMINHADO: "encaminhado para OS", RESOLVIDO: "marcado como resolvido", CANCELADO: "cancelado" };
    setToast(`${ch.codigo} ${labels[newStatus]}`);
    setTimeout(() => setToast(null), 2600);
  };

  const chips = [{ id: "all", label: "Todos" }, ...Object.entries(CHAMADO_STATUS).map(([k, v]) => ({ id: k, label: v.label }))];

  return (
    <CPageShell kicker="Atendimento ao cidadão" title="Chamados"
      description="Triagem e encaminhamento de chamados — abertos via QR Code, app de campo e telefone."
      actions={<CButton variant="filled" icon="plus">Novo chamado</CButton>}>

      <div className="situ-chips chamado-chips">
        {chips.map((c) => (
          <CChip key={c.id} active={status === c.id} count={counts[c.id]} onClick={() => setStatus(c.id)}>{c.label}</CChip>
        ))}
      </div>

      <div className="chamados-grid">
        <section className="card cco-list-panel">
          <div className="filters" style={{ borderBottom: "1px solid var(--line-2)" }}>
            <CSearch value={q} onChange={setQ} placeholder="Buscar por título, código ou unidade…" />
          </div>
          <div className="unit-list">
            {filtered.length === 0 && <div className="empty"><CIcon name="inbox" size={26} /><p>Nenhum chamado</p></div>}
            {filtered.map((c) => {
              const st = CHAMADO_STATUS[c.status];
              return (
                <button key={c.codigo} className={`ch-row ${selected && selected.codigo === c.codigo ? "is-selected" : ""}`} onClick={() => setSel(c.codigo)}>
                  <div className="ch-row-top">
                    <span className="unit-code">{c.codigo}</span>
                    <CBadge tone={PRIOR[c.prioridade]}>{c.prioridade}</CBadge>
                  </div>
                  <div className="unit-name">{c.titulo}</div>
                  <div className="unit-meta"><span>{c.unidade}</span></div>
                  <div className="ch-row-foot">
                    <CBadge tone={st.tone}>{st.label}</CBadge>
                    <span className="ch-when"><CIcon name="clock" size={12} /> {c.aberto.split(" ")[0]}</span>
                    <span className="ch-canal"><CIcon name={c.canal === "QR" ? "crosshair" : c.canal === "App" ? "smartphone" : "bell"} size={12} /> {c.canal}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="chamado-detail-panel">
          <ChamadoDetail ch={selected} onAction={act} />
        </section>
      </div>

      {toast && <div className="toast"><CIcon name="checkCircle" size={16} /> {toast}</div>}
    </CPageShell>
  );
}

window.Chamados = Chamados;
