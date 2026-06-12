// SIGMA — app root: routing, tweaks, shell composition
const { Sidebar, Topbar, PageShell, CCO, Drawer, GuidePanel, Dashboard, Chamados, OrdensServico, Admin, Relatorios, Integracoes, Conta, Checklists, UnidadePage, Icon, Button } = window;
const { useState: useStateA } = React;
const { useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakColor } = window;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "primary": "#0066CC",
  "density": "regular",
  "mapStyle": "light"
}/*EDITMODE-END*/;

const PRIMARY_SHADES = {
  "#0066CC": ["#0066CC", "#005BB5", "#1E7BD6", "#E8F1FC"],   // PMF azul
  "#0B4DA2": ["#0B4DA2", "#0A4490", "#2C68B8", "#E6EEF8"],   // azul profundo
  "#0199DC": ["#0199DC", "#0187C2", "#2BAEE6", "#E3F4FC"],   // ciano accent
  "#1F5FA8": ["#1F5FA8", "#1B5494", "#3F76B8", "#E8F0F9"],   // azul sereno
};

function applyTheme(primary, density) {
  const root = document.documentElement;
  const sh = PRIMARY_SHADES[primary] || PRIMARY_SHADES["#0066CC"];
  root.style.setProperty("--brand", sh[0]);
  root.style.setProperty("--brand-hover", sh[1]);
  root.style.setProperty("--brand-bright", sh[2]);
  root.style.setProperty("--brand-soft", sh[3]);
  root.setAttribute("data-density", density);
}

function Placeholder({ route }) {
  const NAMES = {
    mobile: ["Campo (PWA)", "smartphone", "Fiscalização offline georreferenciada — próxima entrega prioritária."],
    chamados: ["Chamados", "inbox", "Triagem e encaminhamento de chamados cidadãos."],
    os: ["Ordens de serviço", "clipboard", "Acompanhamento de OS com timeline de status."],
    dashboard: ["Dashboard", "grid", "Indicadores executivos, alertas e auditoria."],
    relatorios: ["Relatórios", "chart", "Exportações CSV/PDF por período."],
    admin: ["Administração", "shield", "Cadastros, usuários e LGPD."],
    checklists: ["Checklists", "layers", "Modelos versionados de fiscalização."],
    integracoes: ["Integrações", "plug", "Webhooks e status de sincronização."],
    conta: ["Minha conta", "user", "Preferências e segurança."],
  };
  const [label, icon, desc] = NAMES[route] || ["Em breve", "layers", ""];
  return (
    <PageShell kicker="SIGMA" title={label} description={desc}>
      <div className="placeholder card">
        <div className="placeholder-icon"><Icon name={icon} size={30} /></div>
        <h3>{label}</h3>
        <p>Esta tela faz parte do redesign completo. Construímos primeiro a <b>CCO</b> — o centro de comando — como protótipo interativo de referência. As demais seguem o mesmo sistema.</p>
        <Button variant="outlined" icon="map" onClick={() => window.__setRoute && window.__setRoute("cco")}>Voltar à CCO</Button>
      </div>
    </PageShell>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [route, setRoute] = useStateA("cco");
  const [collapsed, setCollapsed] = useStateA(false);
  const [openUnit, setOpenUnit] = useStateA(null);
  const [unitPage, setUnitPage] = useStateA(null);
  const [guideOpen, setGuideOpen] = useStateA(false);

  React.useEffect(() => { applyTheme(t.primary, t.density); }, [t.primary, t.density]);
  React.useEffect(() => { window.__setRoute = setRoute; window.__openGuide = () => setGuideOpen(true); }, []);

  // keyboard: ? opens guide, Esc closes panels, / focuses search
  React.useEffect(() => {
    const onKey = (e) => {
      const typing = /input|textarea|select/i.test((e.target.tagName || ""));
      if (e.key === "?" && !typing) { e.preventDefault(); setGuideOpen((v) => !v); }
      else if (e.key === "Escape") { setGuideOpen(false); setOpenUnit(null); }
      else if (e.key === "/" && !typing) {
        const s = document.querySelector(".topbar-search input"); if (s) { e.preventDefault(); s.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={`shell ${collapsed ? "is-collapsed" : ""}`}>
      <Sidebar route={route === "unidade" ? "cco" : route} setRoute={(r) => { setRoute(r); setOpenUnit(null); }} collapsed={collapsed} setCollapsed={setCollapsed} />
      <div className="app-main">
        <Topbar />
        <main className="content">
          {route === "cco" ? <CCO mapStyle={t.mapStyle} onOpenUnit={setOpenUnit} />
            : route === "unidade" && unitPage ? <UnidadePage unit={unitPage} mapStyle={t.mapStyle} onBack={() => setRoute("cco")} />
            : route === "dashboard" ? <Dashboard />
            : route === "chamados" ? <Chamados />
            : route === "os" ? <OrdensServico />
            : route === "admin" ? <Admin />
            : route === "relatorios" ? <Relatorios />
            : route === "integracoes" ? <Integracoes />
            : route === "checklists" ? <Checklists />
            : route === "conta" ? <Conta />
            : <Placeholder route={route} />}
        </main>
      </div>

      {openUnit && <Drawer unit={openUnit} onClose={() => setOpenUnit(null)} onOpenPage={(u) => { setOpenUnit(null); setUnitPage(u); setRoute("unidade"); }} />}
      {guideOpen && <GuidePanel route={route} onClose={() => setGuideOpen(false)} />}

      <TweaksPanel>
        <TweakSection label="Identidade" />
        <TweakColor label="Cor primária" value={t.primary}
          options={Object.keys(PRIMARY_SHADES)}
          onChange={(v) => setTweak("primary", v)} />
        <TweakSection label="Layout" />
        <TweakRadio label="Densidade" value={t.density}
          options={["compact", "regular", "comfy"]}
          onChange={(v) => setTweak("density", v)} />
        <TweakSection label="Mapa" />
        <TweakRadio label="Estilo do mapa" value={t.mapStyle}
          options={["light", "dark"]}
          onChange={(v) => setTweak("mapStyle", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
