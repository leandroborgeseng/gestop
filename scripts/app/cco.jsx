// SIGMA — CCO (Central de Controle Operacional)
const { Icon, Button, IconButton, StatusBadge, Chip, Select, SearchInput, MetricCard, PageShell, TipBanner } = window;
const ROLE_HEX = { ok: "#15924E", warn: "#D97706", muted: "#64748B", off: "#94A3B8" };

const { useState, useRef, useEffect, useMemo } = React;

function situRole(situacao) {
  const S = window.SIGMA.SITUACOES[situacao];
  return S ? S.role : "muted";
}

// ---- Leaflet map panel ----
function MapPanel({ units, selectedId, hoverId, onSelect, mapStyle }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const tileRef = useRef(null);
  const labelRef = useRef(null);
  const markersRef = useRef({});
  const [view, setView] = useState("mapa"); // mapa | satelite

  // init once
  useEffect(() => {
    const map = L.map(elRef.current, {
      center: [-20.5365, -47.4035], zoom: 14, zoomControl: false,
      attributionControl: false, preferCanvas: true,
    });
    mapRef.current = map;
    L.control.zoom({ position: "bottomright" }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // tiles (mapa light/dark  •  satélite)
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    if (tileRef.current) { map.removeLayer(tileRef.current); tileRef.current = null; }
    if (labelRef.current) { map.removeLayer(labelRef.current); labelRef.current = null; }
    if (view === "satelite") {
      tileRef.current = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19 }).addTo(map);
      // street + place labels overlay so the imagery stays legible
      labelRef.current = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png",
        { maxZoom: 19, subdomains: "abcd" }).addTo(map);
    } else {
      const url = mapStyle === "dark"
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png";
      tileRef.current = L.tileLayer(url, { maxZoom: 19, subdomains: "abcd" }).addTo(map);
    }
  }, [mapStyle, view]);

  // render markers from units
  useEffect(() => {
    const map = mapRef.current, group = layerRef.current; if (!map) return;
    group.clearLayers(); markersRef.current = {};
    units.forEach((unit) => {
      if (unit.lat == null) return;
      const role = situRole(unit.situacao);
      const hex = ROLE_HEX[role];
      const icon = L.divIcon({
        className: "pin-wrap",
        html: `<span class="pin pin-${role}" style="--pc:${hex}"><b></b></span>`,
        iconSize: [30, 38], iconAnchor: [15, 36],
      });
      const m = L.marker([unit.lat, unit.lng], { icon, riseOnHover: true });
      m.on("click", () => onSelect(unit.id));
      m.addTo(group);
      markersRef.current[unit.id] = m;
    });
  }, [units]);

  // selection / hover styling + pan
  useEffect(() => {
    Object.entries(markersRef.current).forEach(([id, m]) => {
      const el = m.getElement();
      if (!el) return;
      const pin = el.querySelector(".pin");
      if (!pin) return;
      pin.classList.toggle("is-selected", String(selectedId) === id);
      pin.classList.toggle("is-hover", String(hoverId) === id);
    });
    const map = mapRef.current;
    if (map && selectedId) {
      const u = units.find((x) => x.id === selectedId);
      if (u && u.lat != null) map.panTo([u.lat, u.lng], { animate: true, duration: 0.4 });
    }
  }, [selectedId, hoverId, units]);

  const counts = useMemo(() => {
    const c = { ok: 0, warn: 0, off: 0, none: 0 };
    units.forEach((u) => {
      if (u.lat == null) { c.none++; return; }
      const r = situRole(u.situacao); c[r === "muted" ? "off" : r]++;
    });
    return c;
  }, [units]);

  return (
    <div className="map-card">
      <div className="map-el" ref={elRef} />
      <div className="map-legend">
        <div className="map-legend-title">Situação no mapa</div>
        <div className="legend-row"><span className="status-dot status-ok" /> Operacional <b>{counts.ok}</b></div>
        <div className="legend-row"><span className="status-dot status-warn" /> Com pendências <b>{counts.warn}</b></div>
        <div className="legend-row"><span className="status-dot status-off" /> Inativa <b>{counts.off}</b></div>
        {counts.none > 0 && <div className="legend-row legend-muted"><Icon name="pinOff" size={13} /> {counts.none} sem GPS</div>}
      </div>
      <div className="map-float-top">
        <span className="map-chip"><Icon name="layers" size={14} /> {units.filter(u=>u.lat!=null).length} próprios plotados</span>
      </div>
      <div className="map-viewtoggle" role="group" aria-label="Visualização do mapa">
        <button className={view === "mapa" ? "is-on" : ""} onClick={() => setView("mapa")}><Icon name="map" size={14} /> Mapa</button>
        <button className={view === "satelite" ? "is-on" : ""} onClick={() => setView("satelite")}><Icon name="layers" size={14} /> Satélite</button>
      </div>
    </div>
  );
}

// ---- Unit list row ----
function UnitRow({ unit, selected, onSelect, onHover }) {
  const sec = window.SIGMA.SECRETARIAS.find((s) => s.id === unit.secretaria);
  return (
    <button
      className={`unit-row ${selected ? "is-selected" : ""}`}
      onClick={() => onSelect(unit.id)}
      onMouseEnter={() => onHover(unit.id)}
      onMouseLeave={() => onHover(null)}>
      <span className={`unit-rail status-${situRole(unit.situacao)}`} />
      <div className="unit-main">
        <div className="unit-top">
          <span className="unit-code">{unit.codigo}</span>
          {unit.lat == null && <span className="unit-nogps"><Icon name="pinOff" size={11} /> sem GPS</span>}
        </div>
        <div className="unit-name">{unit.nome}</div>
        <div className="unit-meta">
          <span>{unit.tipo}</span><span className="sep">·</span>
          <span>{unit.bairro}</span><span className="sep">·</span>
          <span className="unit-sec">{sec ? sec.id : unit.secretaria}</span>
        </div>
      </div>
      <div className="unit-side">
        <StatusBadge situacao={unit.situacao} size="sm" />
        <div className="unit-stats">
          {unit.nc > 0 && <span className="ustat ustat-nc" title="Não conformidades"><Icon name="alert" size={12} />{unit.nc}</span>}
          {unit.os > 0 && <span className="ustat ustat-os" title="Ordens de serviço"><Icon name="wrench" size={12} />{unit.os}</span>}
          {unit.nc === 0 && unit.os === 0 && unit.situacao === "OPERACIONAL" && <span className="ustat ustat-ok"><Icon name="check" size={12} /></span>}
        </div>
      </div>
    </button>
  );
}

// ---- Filters ----
function CcoFilters({ filters, setFilters, total, shown }) {
  const { SECRETARIAS, BAIRROS, TIPOS } = window.SIGMA;
  const set = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
  const situChips = [
    { id: "all", label: "Todas", role: null },
    { id: "OPERACIONAL", label: "Operacional", role: "ok" },
    { id: "COM_PENDENCIAS", label: "Pendências", role: "warn" },
    { id: "SEM_LOCALIZACAO", label: "Sem GPS", role: "muted" },
    { id: "INATIVA", label: "Inativa", role: "off" },
  ];
  return (
    <div className="filters">
      <SearchInput value={filters.q} onChange={(v) => set("q", v)} placeholder="Buscar por nome ou código…" />
      <div className="filter-selects">
        <Select id="f-sec" value={filters.sec} onChange={(v) => set("sec", v)}
          options={[{ value: "all", label: "Todas as secretarias" }, ...SECRETARIAS.map((s) => ({ value: s.id, label: `${s.id} — ${s.nome}` }))]} />
        <Select id="f-bairro" value={filters.bairro} onChange={(v) => set("bairro", v)}
          options={[{ value: "all", label: "Todos os bairros" }, ...BAIRROS.map((b) => ({ value: b, label: b }))]} />
        <Select id="f-tipo" value={filters.tipo} onChange={(v) => set("tipo", v)}
          options={[{ value: "all", label: "Todos os tipos" }, ...TIPOS.map((t) => ({ value: t, label: t }))]} />
      </div>
      <div className="situ-chips">
        {situChips.map((c) => (
          <Chip key={c.id} active={filters.situ === c.id} dotRole={c.role}
            onClick={() => set("situ", c.id)}>{c.label}</Chip>
        ))}
      </div>
      <div className="filters-foot">
        <span><b>{shown}</b> de {total} próprios</span>
        {(filters.q || filters.sec !== "all" || filters.bairro !== "all" || filters.tipo !== "all" || filters.situ !== "all") &&
          <button className="link-btn" onClick={() => setFilters({ q: "", sec: "all", bairro: "all", tipo: "all", situ: "all" })}>Limpar filtros</button>}
      </div>
    </div>
  );
}

function CCO({ mapStyle, onOpenUnit }) {
  const { UNIDADES, KPIS } = window.SIGMA;
  const [filters, setFilters] = useState({ q: "", sec: "all", bairro: "all", tipo: "all", situ: "all" });
  const [selectedId, setSelectedId] = useState(null);
  const [hoverId, setHoverId] = useState(null);
  const listRef = useRef(null);

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return UNIDADES.filter((u) => {
      if (filters.sec !== "all" && u.secretaria !== filters.sec) return false;
      if (filters.bairro !== "all" && u.bairro !== filters.bairro) return false;
      if (filters.tipo !== "all" && u.tipo !== filters.tipo) return false;
      if (filters.situ !== "all" && u.situacao !== filters.situ) return false;
      if (q && !(`${u.nome} ${u.codigo}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [filters]);

  const select = (id) => {
    setSelectedId(id);
    const u = UNIDADES.find((x) => x.id === id);
    if (u) onOpenUnit(u);
  };

  // KPI quick-filters
  const kpiFilter = (situ) => setFilters((f) => ({ ...f, situ }));

  const actions = (
    <React.Fragment>
      <Button variant="outlined" size="md" icon="download">Exportar</Button>
      <Button variant="filled" size="md" icon="plus">Nova fiscalização</Button>
    </React.Fragment>
  );

  return (
    <PageShell kicker="Central de Controle Operacional" title="Visão operacional"
      description="165 próprios públicos monitorados em tempo real — Prefeitura de Franca." actions={actions}>

      <div className="kpi-row">
        <MetricCard icon="building" accent="brand" label="Próprios monitorados" value={KPIS.total} sub="11 secretarias" onClick={() => kpiFilter("all")} active={filters.situ === "all"} />
        <MetricCard icon="checkCircle" accent="ok" label="Operacionais" value={KPIS.ativos} delta="86%" deltaTone="ok" sub="do total ativo" onClick={() => kpiFilter("OPERACIONAL")} active={filters.situ === "OPERACIONAL"} />
        <MetricCard icon="clipboard" accent="info" label="Fiscalizações no mês" value={KPIS.fiscMes} delta="+5" deltaTone="ok" sub="vs. abril" />
        <MetricCard icon="alert" accent="warn" label="Pendências abertas" value={KPIS.pendencias} sub="exigem ação" onClick={() => kpiFilter("COM_PENDENCIAS")} active={filters.situ === "COM_PENDENCIAS"} />
      </div>

      <TipBanner id="cco_sync" icon="crosshair">
        <b>Mapa e lista trabalham juntos.</b> Filtre, busque ou clique numa unidade — o outro lado acompanha. Clique em qualquer próprio para abrir tudo sobre ele.
      </TipBanner>

      <div className="cco-grid">
        <section className="cco-list-panel card">
          <div className="panel-head">
            <div className="panel-title"><Icon name="list" size={16} /> Unidades</div>
            <span className="panel-count">{filtered.length}</span>
          </div>
          <CcoFilters filters={filters} setFilters={setFilters} total={UNIDADES.length} shown={filtered.length} />
          <div className="unit-list" ref={listRef}>
            {filtered.length === 0 && (
              <div className="empty">
                <Icon name="search" size={26} />
                <p>Nenhum próprio encontrado</p>
                <span>Ajuste os filtros ou a busca.</span>
              </div>
            )}
            {filtered.map((u) => (
              <UnitRow key={u.id} unit={u} selected={selectedId === u.id} onSelect={select} onHover={setHoverId} />
            ))}
          </div>
        </section>

        <section className="cco-map-panel">
          <MapPanel units={filtered} selectedId={selectedId} hoverId={hoverId} onSelect={select} mapStyle={mapStyle} />
        </section>
      </div>
    </PageShell>
  );
}

window.CCO = CCO;
