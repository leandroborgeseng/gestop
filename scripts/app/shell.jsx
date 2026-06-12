// SIGMA — AppShell: desktop sidebar + topbar utility bar.
const { Icon, IconButton } = window;

const NAV_GROUPS = [
  { title: "Operação", items: [
    { id: "cco", label: "CCO", icon: "map", badge: null },
    { id: "mobile", label: "Campo", icon: "smartphone" },
    { id: "chamados", label: "Chamados", icon: "inbox", badge: 5 },
    { id: "os", label: "Ordens de serviço", icon: "clipboard", badge: 3 },
  ]},
  { title: "Gestão", items: [
    { id: "dashboard", label: "Dashboard", icon: "grid" },
    { id: "relatorios", label: "Relatórios", icon: "chart" },
  ]},
  { title: "Configuração", items: [
    { id: "admin", label: "Administração", icon: "shield" },
    { id: "checklists", label: "Checklists", icon: "layers" },
    { id: "integracoes", label: "Integrações", icon: "plug" },
  ]},
];

function Sidebar({ route, setRoute, collapsed, setCollapsed }) {
  return (
    <aside className={`sidebar ${collapsed ? "is-collapsed" : ""}`}>
      <div className="sidebar-head">
        <div className="brand">
          <img src="assets/franca-mark.png" alt="Prefeitura de Franca" className="brand-mark" />
          <div className="brand-text">
            <div className="brand-product">SIGMA</div>
            <div className="brand-sub">Central Operacional</div>
          </div>
        </div>
        <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}>
          <Icon name={collapsed ? "chevronRight" : "chevronLeft"} size={16} />
        </button>
      </div>

      <nav className="nav">
        {NAV_GROUPS.map((g) => (
          <div className="nav-group" key={g.title}>
            <div className="nav-group-title">{g.title}</div>
            {g.items.map((it) => (
              <button key={it.id}
                className={`nav-item ${route === it.id ? "is-active" : ""}`}
                onClick={() => setRoute(it.id)} title={it.label}>
                <Icon name={it.icon} size={19} stroke={route === it.id ? 2.2 : 1.9} />
                <span className="nav-label">{it.label}</span>
                {it.badge != null && <span className="nav-badge">{it.badge}</span>}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-foot">
        <button className={`nav-item ${route === "conta" ? "is-active" : ""}`} onClick={() => setRoute("conta")} title="Minha conta">
          <span className="avatar">RC</span>
          <span className="nav-label nav-user">
            <span className="nav-user-name">Ricardo Campos</span>
            <span className="nav-user-role">Gestor CCO</span>
          </span>
        </button>
        <button className="nav-item nav-logout" title="Sair">
          <Icon name="logout" size={19} stroke={1.9} />
          <span className="nav-label">Sair</span>
        </button>
      </div>
    </aside>
  );
}

function Topbar({ onSearch }) {
  const { KPIS } = window.SIGMA;
  return (
    <header className="topbar">
      <div className="topbar-search">
        <Icon name="search" size={17} className="topbar-search-icon" />
        <input placeholder="Buscar unidade, código, chamado…" onChange={(e) => onSearch && onSearch(e.target.value)} />
        <kbd>/</kbd>
      </div>
      <div className="topbar-actions">
        <button className="guide-trigger" onClick={() => window.__openGuide && window.__openGuide()} title="Abrir guia (?)">
          <Icon name="fileText" size={16} />
          <span>Guia</span>
          <kbd>?</kbd>
        </button>
        <div className="sync-pill" title={`${KPIS.syncPend} sincronizações pendentes`}>
          <span className="sync-dot" />
          <Icon name="refresh" size={14} />
          <span>{KPIS.syncPend} sync pendentes</span>
        </div>
        <div className="online-pill" title="Conexão ativa">
          <span className="online-dot" /> Online
        </div>
        <IconButton icon="bell" label="Notificações" className="topbar-icon has-dot" />
        <IconButton icon="settings" label="Preferências" className="topbar-icon" />
      </div>
    </header>
  );
}

// PageShell: kicker + title + description + action (matches existing pattern)
function PageShell({ kicker, title, description, actions, children }) {
  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head-text">
          {kicker && <div className="page-kicker">{kicker}</div>}
          <h1 className="page-title">{title}</h1>
          {description && <p className="page-desc">{description}</p>}
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

Object.assign(window, { Sidebar, Topbar, PageShell });
