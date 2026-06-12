// SIGMA — Checklists (lista + editor)
const { Icon: KIcon, Button: KButton, Badge: KBadge, PageShell: KPageShell, IconButton: KIconBtn } = window;
const { useState: useStateK } = React;

const TIPO_TONE = { "Sim/Não": "info", "Foto": "warn", "Texto": "neutral" };

function ChecklistEditor({ model }) {
  const { CHECKLIST_ITENS } = window.SIGMA;
  return (
    <div className="card chd">
      <div className="chd-head">
        <div className="chd-head-top">
          <span className="drawer-code">{model.id}</span>
          <div className="chd-badges"><KBadge tone="neutral">{model.versao}</KBadge><KBadge tone={model.status === "Publicado" ? "ok" : "warn"}>{model.status}</KBadge></div>
        </div>
        <h2 className="chd-title">{model.nome}</h2>
        <div className="chd-meta"><span><KIcon name="layers" size={13} /> {model.itens} itens</span><span>{model.secretaria}</span><span>Atualizado {model.atualizado}</span></div>
      </div>
      <div className="chd-body">
        {CHECKLIST_ITENS.map((sec, si) => (
          <div className="ckl-sec" key={si}>
            <div className="ckl-sec-head"><span className="ckl-sec-name">{sec.sec}</span><span className="ckl-sec-count mono">{sec.itens.length}</span></div>
            {sec.itens.map((it, i) => (
              <div className="ckl-item" key={i}>
                <span className="ckl-grip"><KIcon name="more" size={14} /></span>
                <span className="ckl-num mono">{i + 1}</span>
                <span className="ckl-text">{it.t}</span>
                <KBadge tone={TIPO_TONE[it.tipo]}>{it.tipo}</KBadge>
              </div>
            ))}
            <button className="ckl-add"><KIcon name="plus" size={14} /> Adicionar item</button>
          </div>
        ))}
        <div className="chd-actions" style={{ marginTop: 6 }}>
          <KButton variant="filled" icon="check">Publicar nova versão</KButton>
          <KButton variant="outlined" icon="plus">Nova seção</KButton>
        </div>
      </div>
    </div>
  );
}

function Checklists() {
  const { CHECKLISTS } = window.SIGMA;
  const [sel, setSel] = useStateK(CHECKLISTS[0].id);
  const model = CHECKLISTS.find((c) => c.id === sel);
  return (
    <KPageShell kicker="Modelos de fiscalização" title="Checklists"
      description="Modelos versionados aplicados pelos agentes em campo. Publique versões sem quebrar histórico."
      actions={<KButton variant="filled" icon="plus">Novo modelo</KButton>}>
      <div className="chamados-grid">
        <section className="card cco-list-panel">
          <div className="panel-head"><div className="panel-title"><KIcon name="list" size={16} /> Modelos</div><span className="panel-count">{CHECKLISTS.length}</span></div>
          <div className="unit-list">
            {CHECKLISTS.map((c) => (
              <button key={c.id} className={`ch-row ${sel === c.id ? "is-selected" : ""}`} onClick={() => setSel(c.id)}>
                <div className="ch-row-top"><span className="unit-code">{c.id}</span><KBadge tone={c.status === "Publicado" ? "ok" : "warn"}>{c.status}</KBadge></div>
                <div className="unit-name">{c.nome}</div>
                <div className="ch-row-foot"><span className="ch-canal"><KIcon name="layers" size={12} /> {c.itens} itens</span><span className="ch-canal">{c.versao}</span><span className="ch-canal">{c.secretaria}</span></div>
              </button>
            ))}
          </div>
        </section>
        <section className="chamado-detail-panel"><ChecklistEditor model={model} /></section>
      </div>
    </KPageShell>
  );
}

window.Checklists = Checklists;
