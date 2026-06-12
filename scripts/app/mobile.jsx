// SIGMA — Mobile app (Campo PWA + bottom nav + screens)
const { Icon: IconM, StatusBadge: StatusBadgeM, ChecklistRunner } = window;
const { useState: useStateM, useMemo: useMemoM, useEffect: useEffectM, useRef: useRefM } = React;

// ---- agent worklist (today) ----
function buildWorklist() {
  const U = window.SIGMA.UNIDADES;
  const pick = (cod) => U.find((u) => u.codigo === cod);
  const items = [
    { cod: "PMF-ESC-001", checklist: "CKL-ESCOLA v4", status: "todo", dist: "0,4 km" },
    { cod: "PMF-CMEI-014", checklist: "CKL-ESCOLA v4", status: "todo", dist: "1,2 km" },
    { cod: "PMF-UBS-011", checklist: "CKL-SAUDE v3", status: "draft", prog: 0.35, dist: "2,0 km" },
    { cod: "PMF-PRC-003", checklist: "CKL-PRACA v2", status: "todo", dist: "0,8 km" },
    { cod: "PMF-ESC-018", checklist: "CKL-ESCOLA v4", status: "synced", dist: "1,6 km", quando: "Hoje 09:42" },
  ];
  return items.map((it, i) => {
    const u = pick(it.cod) || {};
    return { id: i + 1, codigo: it.cod, nome: u.nome || it.cod, tipo: u.tipo, bairro: u.bairro,
      lat: u.lat, lng: u.lng, checklist: it.checklist, status: it.status, prog: it.prog, dist: it.dist, quando: it.quando };
  });
}

const STATUS_TAG = { todo: ["todo", "A fazer"], draft: ["draft", "Rascunho"], queue: ["queue", "Na fila"], synced: ["synced", "Sincronizado"] };

// ---------- App bar ----------
function MAppBar({ online, setOnline, onGuide }) {
  return (
    <div className="m-appbar">
      <div className="m-appbar-brand">
        <img className="m-appbar-mark" src="assets/franca-mark.png" alt="PMF" />
        <div>
          <div className="m-appbar-title">SIGMA Campo</div>
          <div className="m-appbar-sub">Marcos A. Pereira · Agente</div>
        </div>
      </div>
      <button className="m-appbar-help" onClick={onGuide} aria-label="Guia do app"><IconM name="fileText" size={17} /></button>
      <button className={`m-conn ${online ? "m-conn-on" : "m-conn-off"}`} onClick={() => setOnline(!online)} title="Alternar conexão (demo)">
        <span className="d" />
        {online ? "Online" : "Offline"}
      </button>
    </div>
  );
}

// ---------- Campo home ----------
function CampoHome({ worklist, online, queueCount, onOpen }) {
  const todo = worklist.filter((t) => t.status === "todo" || t.status === "draft");
  const done = worklist.filter((t) => t.status === "queue" || t.status === "synced");
  return (
    <div className="m-body">
      <div className="m-hero">
        <div className="m-hero-top"><span>Roteiro de hoje · 02/06</span><span>Franca · SP</span></div>
        <div className="m-hero-name">{todo.length} fiscalizações pendentes</div>
        <div className="m-hero-stats">
          <div className="m-hero-stat"><div className="v">{todo.length}</div><div className="l">A fazer</div></div>
          <div className="m-hero-stat"><div className="v">{queueCount}</div><div className="l">Na fila</div></div>
          <div className="m-hero-stat"><div className="v">{worklist.filter(t=>t.status==='synced').length}</div><div className="l">Enviadas</div></div>
        </div>
      </div>

      <div className="m-pad">
        <div className="m-section-title">Próximas <span style={{textTransform:"none",letterSpacing:0,fontWeight:600,color:"var(--ink-3)"}}>por proximidade</span></div>
        {todo.map((t) => {
          const [cls, lbl] = STATUS_TAG[t.status];
          return (
            <button className="m-task" key={t.id} onClick={() => onOpen(t)}>
              <div className="m-task-ic"><IconM name={t.tipo === "UBS" || t.tipo === "UPA" ? "shield" : t.tipo === "Praça" ? "pin" : "building"} size={20} /></div>
              <div className="m-task-main">
                <div className="m-task-code">{t.codigo} · {t.dist}</div>
                <div className="m-task-name">{t.nome}</div>
                <div className="m-task-meta">{t.checklist}<span className="sep">·</span><span className={`m-task-tag ${cls}`}>{lbl}</span></div>
                {t.status === "draft" && <div className="m-task-prog"><i style={{ width: `${(t.prog||0)*100}%` }} /></div>}
              </div>
              <IconM name="chevronRight" size={18} className="m-task-arrow" />
            </button>
          );
        })}

        {done.length > 0 && <div className="m-section-title" style={{ marginTop: 18 }}>Concluídas hoje</div>}
        {done.map((t) => {
          const [cls, lbl] = STATUS_TAG[t.status];
          return (
            <div className="m-task" key={t.id} style={{ opacity: t.status === "synced" ? .75 : 1 }}>
              <div className={`m-task-ic ${t.status === "queue" ? "is-queue" : "is-done"}`}><IconM name={t.status === "queue" ? "clock" : "checkCircle"} size={20} /></div>
              <div className="m-task-main">
                <div className="m-task-code">{t.codigo}</div>
                <div className="m-task-name">{t.nome}</div>
                <div className="m-task-meta">{t.status === "queue" ? "Aguardando conexão" : t.quando || "Enviada"}<span className="sep">·</span><span className={`m-task-tag ${cls}`}>{lbl}</span></div>
              </div>
            </div>
          );
        })}
        <div style={{ height: 90 }} />
      </div>
    </div>
  );
}

// ---------- Mobile CCO (map + list, consulta) ----------
function MccoScreen({ online }) {
  const elRef = useRefM(null);
  const mapRef = useRefM(null);
  const tileRef = useRefM(null);
  const labelRef = useRefM(null);
  const [filter, setFilter] = useStateM("all");
  const [view, setView] = useStateM("mapa");
  const ROLE_HEX = { ok: "#15924E", warn: "#D97706", muted: "#64748B", off: "#94A3B8" };
  const units = useMemoM(() => window.SIGMA.UNIDADES.filter((u) => u.lat != null), []);
  const shown = useMemoM(() => filter === "all" ? units : units.filter((u) => u.situacao === filter), [filter]);

  useEffectM(() => {
    const map = L.map(elRef.current, { center: [-20.5365, -47.4035], zoom: 13, zoomControl: false, attributionControl: false });
    mapRef.current = map;
    const grp = L.layerGroup().addTo(map);
    shown.forEach((u) => {
      const role = window.SIGMA.SITUACOES[u.situacao].role;
      const hex = ROLE_HEX[role] || "#64748B";
      L.marker([u.lat, u.lng], { icon: L.divIcon({ className: "pin-wrap", html: `<span class="pin pin-${role}" style="--pc:${hex}"><b></b></span>`, iconSize: [24, 30], iconAnchor: [12, 28] }) }).addTo(grp);
    });
    setTimeout(() => map.invalidateSize(), 200);
    return () => map.remove();
  }, [shown]);

  // basemap: mapa | satelite
  useEffectM(() => {
    const map = mapRef.current; if (!map) return;
    if (tileRef.current) { map.removeLayer(tileRef.current); tileRef.current = null; }
    if (labelRef.current) { map.removeLayer(labelRef.current); labelRef.current = null; }
    if (view === "satelite") {
      tileRef.current = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19 }).addTo(map);
      labelRef.current = L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png", { subdomains: "abcd" }).addTo(map);
    } else {
      tileRef.current = L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png", { subdomains: "abcd" }).addTo(map);
    }
  }, [view, shown]);

  const chips = [["all","Todas"],["OPERACIONAL","Operacional"],["COM_PENDENCIAS","Pendências"],["INATIVA","Inativa"]];
  return (
    <div className="m-body" style={{ display: "flex", flexDirection: "column" }}>
      <div className="m-map">
        <div className="map-el" ref={elRef} />
        <div className="map-viewtoggle m-mapview" role="group" aria-label="Visualização">
          <button className={view === "mapa" ? "is-on" : ""} onClick={() => setView("mapa")}><IconM name="map" size={13} /> Mapa</button>
          <button className={view === "satelite" ? "is-on" : ""} onClick={() => setView("satelite")}><IconM name="layers" size={13} /> Satélite</button>
        </div>
      </div>
      <div className="m-filterbar">
        {chips.map(([id, lbl]) => (
          <button key={id} className={`chip ${filter === id ? "is-active" : ""}`} onClick={() => setFilter(id)}>{lbl}</button>
        ))}
      </div>
      <div style={{ flex: 1 }}>
        {shown.map((u) => {
          const role = window.SIGMA.SITUACOES[u.situacao].role;
          return (
            <div className="m-row" key={u.id}>
              <span className="m-row-rail" style={{ background: ROLE_HEX[role] }} />
              <div className="m-row-main">
                <div className="m-row-code">{u.codigo}</div>
                <div className="m-row-title">{u.nome}</div>
                <div className="m-row-meta">{u.tipo}<span className="sep">·</span>{u.bairro}</div>
              </div>
              <StatusBadgeM situacao={u.situacao} size="sm" />
            </div>
          );
        })}
        <div style={{ height: 80 }} />
      </div>
    </div>
  );
}

// ---------- Mobile Chamados ----------
function MchamadosScreen() {
  const CH = window.SIGMA.CHAMADOS;
  const ST = window.SIGMA.CHAMADO_STATUS;
  const PR = window.SIGMA.PRIOR;
  return (
    <div className="m-body">
      <div className="m-filterbar">
        <button className="chip is-active">Todos</button>
        <button className="chip">Abertos</button>
        <button className="chip">Em triagem</button>
        <button className="chip">Encaminhados</button>
      </div>
      {CH.map((c) => {
        const st = ST[c.status] || {};
        return (
          <div className="m-row" key={c.codigo}>
            <span className="m-row-rail" style={{ background: `var(--${(PR[c.prioridade]||"muted")==="warn"?"warn":(PR[c.prioridade]==="danger"?"danger":"brand")})` }} />
            <div className="m-row-main">
              <div className="m-row-code">{c.codigo}</div>
              <div className="m-row-title">{c.titulo}</div>
              <div className="m-row-meta">{c.unidade}<span className="sep">·</span>{c.bairro}</div>
            </div>
            <span className={`badge badge-${st.role === "ok" ? "ok" : st.role === "warn" ? "warn" : st.role === "info" ? "info" : "neutral"}`}>{st.label || c.status}</span>
          </div>
        );
      })}
      <div style={{ height: 80 }} />
    </div>
  );
}

// ---- mobile contextual guide (manual em tempo real) ----
const MGUIDE = {
  resumo: "O app de campo funciona online e offline. Tudo que você responde é salvo no aparelho na hora e enviado à CCO assim que houver conexão.",
  howto: [
    { t: "Iniciar uma fiscalização", s: ["Toque numa unidade do roteiro.", "Confirme o check-in para registrar sua presença (funciona offline).", "Responda os itens do checklist."] },
    { t: "Registrar um problema", s: ["Marque o item como 'Não conf.'.", "Descreva o que encontrou e anexe uma foto.", "Continue — a contagem de não conformidades aparece no topo."] },
    { t: "Trabalhar sem internet", s: ["O selo Offline indica que voc\u00ea est\u00e1 sem conex\u00e3o.", "Conclua normalmente — a fiscaliza\u00e7\u00e3o vai para a fila.", "Ao reconectar, toque em 'Sincronizar' para enviar tudo."] },
  ],
  gloss: [
    { k: "Check-in", v: "Confirmação georreferenciada de que você está no local." },
    { k: "Fila de sincronização", v: "Fiscalizações concluídas offline aguardando envio." },
    { k: "Não conformidade", v: "Item reprovado — gera registro para a equipe corrigir." },
  ],
};

function MHowTo({ item }) {
  const [open, setOpen] = useStateM(false);
  return (
    <div className={`howto ${open ? "is-open" : ""}`}>
      <button className="howto-head" onClick={() => setOpen(!open)}>
        <span className="howto-t">{item.t}</span>
        <IconM name="chevronDown" size={16} className="howto-caret" />
      </button>
      {open && <ol className="howto-steps">{item.s.map((s, i) => <li key={i}>{s}</li>)}</ol>}
    </div>
  );
}

function MobileGuide({ online, onClose }) {
  return (
    <div className="m-run" style={{ zIndex: 60 }}>
      <div className="guide-head" style={{ flexShrink: 0 }}>
        <div className="guide-head-row">
          <div className="guide-badge"><IconM name="fileText" size={18} /></div>
          <div><div className="guide-title">Guia do app</div><div className="guide-subtitle">Manual em tempo real</div></div>
          <button className="icon-btn guide-close" onClick={onClose} aria-label="Fechar"><IconM name="x" size={18} /></button>
        </div>
        <div className="guide-where"><IconM name="smartphone" size={13} /> Você está em <b>Campo — fiscalização</b></div>
      </div>
      <div className="m-body">
        <div className="guide-body">
          <section className="guide-sec"><div className="guide-sec-title">Como funciona</div><p className="guide-resumo">{MGUIDE.resumo}</p></section>
          <section className="guide-sec"><div className="guide-sec-title">Como fazer</div><div className="howto-list">{MGUIDE.howto.map((it, i) => <MHowTo key={i} item={it} />)}</div></section>
          <section className="guide-sec"><div className="guide-sec-title">Glossário</div><dl className="gloss">{MGUIDE.gloss.map((it, i) => <div className="gloss-item" key={i}><dt>{it.k}</dt><dd>{it.v}</dd></div>)}</dl></section>
          <div className="guide-foot"><IconM name={online ? "checkCircle" : "wifiOff"} size={15} /><span>{online ? "Conectado — sincronização automática ativa." : "Offline — nada se perde; envie ao reconectar."}</span></div>
        </div>
      </div>
    </div>
  );
}

// ---------- Mais sheet ----------
function MaisSheet({ onClose, online, onOpenGuide }) {
  const links = [
    ["map", "Mapa CCO"], ["clipboard", "Ordens de serviço"], ["layers", "Checklists"],
    ["refresh", "Fila de sincronização"], ["fileText", "Guia do app"], ["user", "Minha conta"],
  ];
  return (
    <React.Fragment>
      <div className="m-sheet-scrim" onClick={onClose} />
      <div className="m-sheet">
        <div className="m-sheet-grip" />
        <div className="m-sheet-title">Mais opções</div>
        <div className="m-sheet-grid">
          {links.map(([ic, t]) => (
            <button className="m-sheet-link" key={t} onClick={() => { if (t === "Guia do app") { onClose(); onOpenGuide(); } else onClose(); }}>
              <span className="si"><IconM name={ic} size={18} /></span>
              <span className="st">{t}</span>
            </button>
          ))}
        </div>
        <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: online ? "var(--ok-bg)" : "var(--warn-bg)", color: online ? "var(--ok)" : "var(--warn)", fontSize: 12, fontWeight: 600, display: "flex", gap: 9, alignItems: "center" }}>
          <IconM name={online ? "checkCircle" : "wifiOff"} size={16} />
          {online ? "Tudo sincronizado e conectado." : "Modo offline — suas respostas ficam salvas e enviam ao reconectar."}
        </div>
      </div>
    </React.Fragment>
  );
}

// ---------- Done screen ----------
function DoneScreen({ result, online, onClose }) {
  return (
    <div className="m-done">
      <div className="m-done-check"><IconM name="check" size={42} /></div>
      <h2>Fiscalização concluída</h2>
      <p>{online ? "Registro enviado e sincronizado com a CCO." : "Registro salvo no dispositivo. Será enviado automaticamente ao reconectar."}</p>
      <div className="m-done-card">
        <div className="r"><dt>Itens respondidos</dt><dd>{result.answeredCount}/{result.total}</dd></div>
        <div className="r"><dt>Não conformidades</dt><dd style={{ color: result.ncCount ? "var(--danger)" : "var(--ink)" }}>{result.ncCount}</dd></div>
        <div className="r"><dt>Status de envio</dt><dd style={{ color: online ? "var(--ok)" : "var(--warn)" }}>{online ? "Sincronizado" : "Na fila"}</dd></div>
      </div>
      <button className="m-done-btn" onClick={onClose}>Voltar ao roteiro</button>
    </div>
  );
}

// ---------- Bottom nav ----------
function MBottomNav({ tab, setTab, queueCount }) {
  const items = [["campo", "smartphone", "Campo"], ["cco", "map", "Mapa"], ["chamados", "inbox", "Chamados"], ["mais", "more", "Mais"]];
  return (
    <div className="m-botnav">
      {items.map(([id, ic, lbl]) => (
        <button key={id} className={`m-nav-item ${tab === id ? "is-active" : ""}`} onClick={() => setTab(id)}>
          <span className="ic-wrap">
            <IconM name={ic} size={21} stroke={tab === id ? 2.2 : 1.9} />
            {id === "chamados" && <span className="m-nav-badge">5</span>}
          </span>
          <span className="lbl">{lbl}</span>
        </button>
      ))}
    </div>
  );
}

// ---------- Root ----------
function MobileApp() {
  const [tab, setTab] = useStateM("campo");
  const [online, setOnline] = useStateM(false); // start OFFLINE to show productivity
  const [worklist, setWorklist] = useStateM(buildWorklist);
  const [active, setActive] = useStateM(null);   // running checklist task
  const [result, setResult] = useStateM(null);   // done screen
  const [maisOpen, setMaisOpen] = useStateM(false);
  const [guideOpen, setGuideOpen] = useStateM(false);
  const [syncing, setSyncing] = useStateM(false);
  const [toast, setToast] = useStateM(null);

  const queueCount = useMemoM(() => worklist.filter((t) => t.status === "queue").length, [worklist]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2600); };

  const finishInspection = (res) => {
    setWorklist((wl) => wl.map((t) => t.id === active.id
      ? { ...t, status: res.online ? "synced" : "queue", quando: res.online ? "Agora" : undefined } : t));
    setResult({ ...res });
    setActive(null);
  };

  const doSync = () => {
    if (!online || queueCount === 0 || syncing) { if (!online) showToast("Sem conexão — conecte para enviar"); return; }
    setSyncing(true);
    setTimeout(() => {
      setWorklist((wl) => wl.map((t) => t.status === "queue" ? { ...t, status: "synced", quando: "Agora" } : t));
      setSyncing(false);
      showToast(`${queueCount} fiscalização(ões) enviada(s)`);
    }, 1700);
  };

  const openTask = (t) => { setActive(t); setMaisOpen(false); };

  return (
    <div className="m-screen">
      <MAppBar online={online} setOnline={(v) => { setOnline(v); showToast(v ? "Conectado — sincronização disponível" : "Modo offline ativado"); }} onGuide={() => setGuideOpen(true)} />
      {!online && (
        <div className="m-offline-banner">
          <IconM name="wifiOff" size={14} /> Modo offline — tudo é salvo no aparelho e enviado ao reconectar.
        </div>
      )}

      {tab === "campo" && <CampoHome worklist={worklist} online={online} queueCount={queueCount} onOpen={openTask} />}
      {tab === "cco" && <MccoScreen online={online} />}
      {tab === "chamados" && <MchamadosScreen />}
      {tab === "mais" && <CampoHome worklist={worklist} online={online} queueCount={queueCount} onOpen={openTask} />}

      {/* sync FAB on campo */}
      {tab === "campo" && queueCount > 0 && (
        <button className={`m-fab ${syncing ? "is-syncing spin" : ""}`} onClick={doSync}>
          <IconM name="refresh" size={18} />
          {syncing ? "Sincronizando…" : <React.Fragment>Sincronizar <span className="fab-badge">{queueCount}</span></React.Fragment>}
        </button>
      )}

      <MBottomNav tab={tab} setTab={(id) => { if (id === "mais") setMaisOpen(true); else { setTab(id); } }} queueCount={queueCount} />

      {maisOpen && <MaisSheet onClose={() => setMaisOpen(false)} online={online} onOpenGuide={() => setGuideOpen(true)} />}
      {guideOpen && <MobileGuide online={online} onClose={() => setGuideOpen(false)} />}
      {active && <ChecklistRunner task={active} online={online} onClose={() => setActive(null)} onFinish={finishInspection} />}
      {result && <DoneScreen result={result} online={result.online} onClose={() => setResult(null)} />}

      {toast && (
        <div className="m-toast"><span className="ti"><IconM name="check" size={15} /></span>{toast}</div>
      )}
    </div>
  );
}

window.MobileApp = MobileApp;
