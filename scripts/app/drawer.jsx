// SIGMA — Unit detail drawer (slides over the right side)
const { Icon, Button, IconButton, StatusBadge, Tabs, Badge } = window;
const { useState: useStateD, useEffect: useEffectD } = React;

// deterministic pseudo-random from unit id
function seed(n) { let x = Math.sin(n * 9973) * 10000; return x - Math.floor(x); }

const NC_POOL = [
  "Infiltração no forro da sala", "Extintor com carga vencida", "Lâmpadas queimadas no corredor",
  "Piso tátil danificado na entrada", "Vazamento no banheiro do 2º andar", "Grades de proteção soltas",
  "Sinalização de emergência ausente", "Caixa d'água sem tampa de vedação",
];
const OS_POOL = [
  { t: "Reparo hidráulico — banheiro", p: "URGENTE" }, { t: "Recarga de extintores", p: "ALTA" },
  { t: "Troca de luminárias LED", p: "MÉDIA" }, { t: "Manutenção elétrica preventiva", p: "MÉDIA" },
  { t: "Pintura de sinalização de solo", p: "BAIXA" },
];

function genRecords(unit) {
  const fisc = [];
  for (let i = 0; i < Math.max(unit.fisc, 1); i++) {
    const ok = seed(unit.id + i) > 0.4;
    fisc.push({
      data: `${String(2 + (i * 3) % 26).padStart(2, "0")}/0${1 + (i % 5)}/2026`,
      agente: ["Marcos A. Pereira", "Ana P. Lima", "Paulo R. Dias", "Carla D. Moura"][(unit.id + i) % 4],
      conforme: ok ? Math.round(88 + seed(unit.id + i) * 11) : Math.round(60 + seed(unit.id + i) * 20),
      itens: 24,
    });
  }
  const ncs = [];
  for (let i = 0; i < unit.nc; i++) {
    ncs.push({
      titulo: NC_POOL[(unit.id * 3 + i) % NC_POOL.length],
      sev: ["Alta", "Média", "Baixa"][(unit.id + i) % 3],
      aberta: `${10 + i * 4}/05/2026`,
      status: seed(unit.id * 7 + i) > 0.5 ? "Em OS" : "Aberta",
    });
  }
  const oss = [];
  for (let i = 0; i < unit.os; i++) {
    const o = OS_POOL[(unit.id + i) % OS_POOL.length];
    oss.push({
      codigo: `OS-2026-00${40 + unit.id + i}`, titulo: o.t, prioridade: o.p,
      prazo: `${i + 2} dias`, status: ["Aberta", "Em execução", "Aguardando peça"][(unit.id + i) % 3],
    });
  }
  return { fisc, ncs, oss };
}

const PRIOR_TONE = { URGENTE: "danger", ALTA: "warn", "MÉDIA": "info", BAIXA: "neutral" };

function Drawer({ unit, onClose, onOpenPage }) {
  const [tab, setTab] = useStateD("geral");
  useEffectD(() => { setTab("geral"); }, [unit && unit.id]);
  if (!unit) return null;
  const sec = window.SIGMA.SECRETARIAS.find((s) => s.id === unit.secretaria);
  const { fisc, ncs, oss } = genRecords(unit);

  const tabs = [
    { id: "geral", label: "Visão geral" },
    { id: "fisc", label: "Fiscalizações", count: fisc.length },
    { id: "nc", label: "Não conformidades", count: ncs.length },
    { id: "os", label: "Ordens", count: oss.length },
  ];

  return (
    <React.Fragment>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={`Detalhe ${unit.nome}`}>
        <header className="drawer-head">
          <div className="drawer-head-top">
            <span className="drawer-code">{unit.codigo}</span>
            <IconButton icon="x" label="Fechar" onClick={onClose} />
          </div>
          <h2 className="drawer-title">{unit.nome}</h2>
          <div className="drawer-sub">
            <StatusBadge situacao={unit.situacao} size="sm" />
            <span className="drawer-sub-meta">{unit.tipo} · {unit.bairro}</span>
          </div>
        </header>

        <div className="drawer-tabs"><Tabs tabs={tabs} active={tab} onChange={setTab} /></div>

        <div className="drawer-body">
          {tab === "geral" && (
            <div className="dg">
              <div className="dg-stats">
                <div className="dg-stat"><span className="dg-stat-v">{unit.fisc}</span><span className="dg-stat-l">Fiscalizações</span></div>
                <div className="dg-stat"><span className="dg-stat-v" data-tone={unit.nc ? "warn" : ""}>{unit.nc}</span><span className="dg-stat-l">Não conf.</span></div>
                <div className="dg-stat"><span className="dg-stat-v" data-tone={unit.os ? "info" : ""}>{unit.os}</span><span className="dg-stat-l">Ordens</span></div>
              </div>
              <dl className="dg-meta">
                <div><dt>Secretaria</dt><dd>{sec ? sec.full : unit.secretaria}</dd></div>
                <div><dt>Endereço</dt><dd>{unit.endereco}</dd></div>
                <div><dt>Responsável</dt><dd>{unit.responsavel}</dd></div>
                <div><dt>Última fiscalização</dt><dd>{unit.ultima}</dd></div>
                <div><dt>Matrícula patrimonial</dt><dd className="mono">{unit.matricula}</dd></div>
                <div><dt>Área construída</dt><dd>{unit.area} m²</dd></div>
                {unit.lat != null
                  ? <div><dt>Coordenadas</dt><dd className="mono">{unit.lat.toFixed(4)}, {unit.lng.toFixed(4)}</dd></div>
                  : <div><dt>Coordenadas</dt><dd className="warn-text"><Icon name="pinOff" size={13} /> Sem localização</dd></div>}
              </dl>
              <div className="dg-actions">
                <Button variant="filled" size="md" icon="clipboard">Nova fiscalização</Button>
                <Button variant="outlined" size="md" icon="wrench">Abrir OS</Button>
              </div>
              <button className="drawer-fullpage" onClick={() => onOpenPage && onOpenPage(unit)}>
                <Icon name="arrowUpRight" size={15} /> Abrir página completa da unidade
              </button>
            </div>
          )}

          {tab === "fisc" && (
            <div className="rec-list">
              {fisc.map((f, i) => (
                <div className="rec" key={i}>
                  <div className={`rec-icon ${f.conforme >= 85 ? "ri-ok" : "ri-warn"}`}><Icon name="clipboard" size={16} /></div>
                  <div className="rec-main">
                    <div className="rec-title">Checklist padrão · {f.itens} itens</div>
                    <div className="rec-meta"><Icon name="user" size={12} /> {f.agente} <span className="sep">·</span> <Icon name="calendar" size={12} /> {f.data}</div>
                  </div>
                  <div className={`conf ${f.conforme >= 85 ? "conf-ok" : "conf-warn"}`}>{f.conforme}%<span>conforme</span></div>
                </div>
              ))}
            </div>
          )}

          {tab === "nc" && (
            <div className="rec-list">
              {ncs.length === 0 && <div className="empty sm"><Icon name="checkCircle" size={22} /><p>Nenhuma não conformidade</p></div>}
              {ncs.map((n, i) => (
                <div className="rec" key={i}>
                  <div className={`rec-icon ri-${n.sev === "Alta" ? "danger" : n.sev === "Média" ? "warn" : "muted"}`}><Icon name="alert" size={16} /></div>
                  <div className="rec-main">
                    <div className="rec-title">{n.titulo}</div>
                    <div className="rec-meta">Severidade {n.sev} <span className="sep">·</span> aberta em {n.aberta}</div>
                  </div>
                  <Badge tone={n.status === "Em OS" ? "info" : "warn"}>{n.status}</Badge>
                </div>
              ))}
            </div>
          )}

          {tab === "os" && (
            <div className="rec-list">
              {oss.length === 0 && <div className="empty sm"><Icon name="checkCircle" size={22} /><p>Nenhuma ordem aberta</p></div>}
              {oss.map((o, i) => (
                <div className="rec" key={i}>
                  <div className="rec-icon ri-info"><Icon name="wrench" size={16} /></div>
                  <div className="rec-main">
                    <div className="rec-title">{o.titulo}</div>
                    <div className="rec-meta"><span className="mono">{o.codigo}</span> <span className="sep">·</span> prazo {o.prazo} <span className="sep">·</span> {o.status}</div>
                  </div>
                  <Badge tone={PRIOR_TONE[o.prioridade] || "neutral"}>{o.prioridade}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </React.Fragment>
  );
}

window.Drawer = Drawer;
window.__genRecords = genRecords;
