// SIGMA — UI primitives. Styling lives in the global stylesheet (classes).
const { Icon } = window;

function Button({ variant = "filled", size = "md", icon, iconRight, children, className = "", ...rest }) {
  return (
    <button className={`btn btn-${variant} btn-${size} ${className}`} {...rest}>
      {icon && <Icon name={icon} size={size === "sm" ? 15 : 17} stroke={2} />}
      {children && <span>{children}</span>}
      {iconRight && <Icon name={iconRight} size={size === "sm" ? 15 : 17} stroke={2} />}
    </button>
  );
}

function IconButton({ icon, label, active, className = "", ...rest }) {
  return (
    <button aria-label={label} title={label}
      className={`icon-btn ${active ? "is-active" : ""} ${className}`} {...rest}>
      <Icon name={icon} size={18} />
    </button>
  );
}

function Card({ className = "", children, ...rest }) {
  return <div className={`card ${className}`} {...rest}>{children}</div>;
}

// Status badge for situacao roles: ok / warn / muted / off
function StatusBadge({ situacao, size = "md" }) {
  const S = window.SIGMA.SITUACOES[situacao];
  const role = S ? S.role : "muted";
  return (
    <span className={`status status-${role} status-${size}`}>
      <span className="status-dot" />
      {S ? S.label : situacao}
    </span>
  );
}

function Badge({ tone = "neutral", children }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function Chip({ active, onClick, children, count, dotRole }) {
  return (
    <button className={`chip ${active ? "is-active" : ""}`} onClick={onClick}>
      {dotRole && <span className={`chip-dot status-dot status-${dotRole}`} />}
      {children}
      {count != null && <span className="chip-count">{count}</span>}
    </button>
  );
}

function Field({ label, hint, children, htmlFor }) {
  return (
    <label className="field" htmlFor={htmlFor}>
      {label && <span className="field-label">{label}</span>}
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

function Select({ value, onChange, options, id }) {
  return (
    <div className="select-wrap">
      <select id={id} className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <Icon name="chevronDown" size={16} className="select-caret" />
    </div>
  );
}

function SearchInput({ value, onChange, placeholder }) {
  return (
    <div className="search">
      <Icon name="search" size={16} className="search-icon" />
      <input className="search-input" value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)} />
      {value && (
        <button className="search-clear" onClick={() => onChange("")} aria-label="Limpar">
          <Icon name="x" size={14} />
        </button>
      )}
    </div>
  );
}

function MetricCard({ icon, label, value, delta, deltaTone = "neutral", sub, accent = "brand", onClick, active }) {
  return (
    <button className={`metric ${active ? "is-active" : ""}`} onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
      <div className={`metric-icon metric-icon-${accent}`}>
        <Icon name={icon} size={18} />
      </div>
      <div className="metric-body">
        <div className="metric-label">{label}</div>
        <div className="metric-value-row">
          <span className="metric-value">{value}</span>
          {delta && <span className={`metric-delta delta-${deltaTone}`}>{delta}</span>}
        </div>
        {sub && <div className="metric-sub">{sub}</div>}
      </div>
    </button>
  );
}

function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={active === t.id}
          className={`tab ${active === t.id ? "is-active" : ""}`}
          onClick={() => onChange(t.id)}>
          {t.label}
          {t.count != null && <span className="tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

Object.assign(window, {
  Button, IconButton, Card, StatusBadge, Badge, Chip, Field, Select, SearchInput, MetricCard, Tabs,
});
