// SIGMA — Detalhe da unidade (página cheia)
const { Icon: UIcon, Button: UButton, Badge: UBadge, StatusBadge: UStatus, Tabs: UTabs, PageShell: UPageShell } = window;
const { useState: useStateU, useEffect: useEffectU, useRef: useRefU } = React;

const UROLE_HEX = { ok: "#15924E", warn: "#D97706", muted: "#64748B", off: "#94A3B8" };

function MiniMap({ unit, mapStyle }) {
  const el = useRefU(null), map = useRefU(null);
  useEffectU(() => {
    if (unit.lat == null) return;
    const m = L.map(el.current, { center: [unit.lat, unit.lng], zoom: 16, zoomControl: false, attributionControl: false, dragging: true, scrollWheelZoom: false });
    map.current = m;
    const url = mapStyle === "dark" ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png";
    L.tileLayer(url, { subdomains: "abcd" }).addTo(m);
    const role = window.SIGMA.SITUACOES[unit.situacao].role;
    L.marker([unit.lat, unit.lng], { icon: L.divIcon({ className: "pin-wrap", html: `<span class="pin pin-${role} is-selected" style="--pc:${UROLE_HEX[role]}"><b></b></span>`, iconSize: [30, 38], iconAnchor: [15, 36] }) }).addTo(m);
    setTimeout(() => m.invalidateSize(), 250);
    return () => m.remove();
  }, [unit.id, mapStyle]);
  if (unit.lat == null) return (
    <div className="card minimap-empty"><UIcon name="pinOff" size={26} /><p>Sem georreferenciamento</p><span>Faça o check-in GPS em campo para localizar.</span></div>
  );
  return <div className="card minimap"><div className="minimap-el" ref={el} /></div>;
}

function UnidadePage({ unit, mapStyle, onBack }) {
  const [tab, setTab] = useStateU("fisc");
  const sec = window.SIGMA.SECRETARIAS.find((s) => s.id === unit.secretaria);
  const { fisc, ncs, oss } = window.__genRecords(unit);
  const { PRIOR } = window.SIGMA;
  const tabs = [{ id: "fisc", label: "Fiscalizações", count: fisc.length }, { id: "nc", label: "Não conformidades", count: ncs.length }, { id: "os", label: "Ordens", count: oss.length }];

  return (
    <UPageShell kicker={<span className="bc"><button className="bc-link" onClick={onBack}>CCO</button> / Unidades / {unit.codigo}</span>}
      title={unit.nome}
      description={`${unit.tipo} · ${unit.bairro} · ${sec ? sec.full : unit.secretaria}`}
      actions={<React.Fragment><UButton variant="outlined" icon="chevronLeft" onClick={onBack}>Voltar</UButton><UButton variant="filled" icon="clipboard">Nova fiscalização</UButton></React.Fragment>}>
      <div className="dash-scroll">
        <div className="uni-top">
          <div className="uni-status-bar">
            <UStatus situacao={unit.situacao} />
            <div className="uni-stats-inline">
              <span><b>{unit.fisc}</b> fiscalizações</span>
              <span className={unit.nc ? "warn-text" : ""}><b>{unit.nc}</b> não conf.</span>
              <span className={unit.os ? "info-text" : ""}><b>{unit.os}</b> ordens</span>
            </div>
          </div>
        </div>

        <div className="uni-grid">
          <MiniMap unit={unit} mapStyle={mapStyle} />
          <div className="card uni-meta-card">
            <div className="panel-head"><div className="panel-title"><UIcon name="building" size={15} /> Dados patrimoniais</div></div>
            <dl className="dg-meta" style={{ padding: "4px 16px 12px" }}>
              <div><dt>Endereço</dt><dd>{unit.endereco}</dd></div>
              <div><dt>Responsável</dt><dd>{unit.responsavel}</dd></div>
              <div><dt>Matrícula</dt><dd className="mono">{unit.matricula}</dd></div>
              <div><dt>Área construída</dt><dd>{unit.area} m²</dd></div>
              <div><dt>Última fiscalização</dt><dd>{unit.ultima}</dd></div>
              {unit.lat != null ? <div><dt>Coordenadas</dt><dd className="mono">{unit.lat.toFixed(4)}, {unit.lng.toFixed(4)}</dd></div>
                : <div><dt>Coordenadas</dt><dd className="warn-text"><UIcon name="pinOff" size={13} /> Sem localização</dd></div>}
            </dl>
          </div>
        </div>

        <div className="card">
          <div className="drawer-tabs" style={{ padding: "0 18px" }}><UTabs tabs={tabs} active={tab} onChange={setTab} /></div>
          <div style={{ padding: 16 }}>
            {tab === "fisc" && <div className="rec-list">{fisc.map((f, i) => (
              <div className="rec" key={i}><div className={`rec-icon ${f.conforme >= 85 ? "ri-ok" : "ri-warn"}`}><UIcon name="clipboard" size={16} /></div>
                <div className="rec-main"><div className="rec-title">Checklist padrão · {f.itens} itens</div><div className="rec-meta"><UIcon name="user" size={12} /> {f.agente} · {f.data}</div></div>
                <div className={`conf ${f.conforme >= 85 ? "conf-ok" : "conf-warn"}`}>{f.conforme}%<span>conforme</span></div></div>
            ))}</div>}
            {tab === "nc" && <div className="rec-list">{ncs.length === 0 ? <div className="empty sm"><UIcon name="checkCircle" size={22} /><p>Sem não conformidades</p></div> : ncs.map((n, i) => (
              <div className="rec" key={i}><div className={`rec-icon ri-${n.sev === "Alta" ? "danger" : n.sev === "Média" ? "warn" : "muted"}`}><UIcon name="alert" size={16} /></div>
                <div className="rec-main"><div className="rec-title">{n.titulo}</div><div className="rec-meta">Severidade {n.sev} · aberta em {n.aberta}</div></div><UBadge tone={n.status === "Em OS" ? "info" : "warn"}>{n.status}</UBadge></div>
            ))}</div>}
            {tab === "os" && <div className="rec-list">{oss.length === 0 ? <div className="empty sm"><UIcon name="checkCircle" size={22} /><p>Nenhuma ordem aberta</p></div> : oss.map((o, i) => (
              <div className="rec" key={i}><div className="rec-icon ri-info"><UIcon name="wrench" size={16} /></div>
                <div className="rec-main"><div className="rec-title">{o.titulo}</div><div className="rec-meta"><span className="mono">{o.codigo}</span> · prazo {o.prazo} · {o.status}</div></div><UBadge tone={PRIOR[o.prioridade] || "neutral"}>{o.prioridade}</UBadge></div>
            ))}</div>}
          </div>
        </div>
      </div>
    </UPageShell>
  );
}

window.UnidadePage = UnidadePage;
