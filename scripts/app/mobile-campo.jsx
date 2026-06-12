// SIGMA — Mobile: Checklist Runner (execução de fiscalização offline)
const { Icon: IconR } = window;
const { useState: useStateR, useMemo: useMemoR, useRef: useRefR } = React;

// answer model: { [secIdx-itemIdx]: { val, nota, fotos } }
function ChecklistRunner({ task, online, onClose, onFinish }) {
  const SECS = window.SIGMA.CHECKLIST_ITENS;
  const total = useMemoR(() => SECS.reduce((n, s) => n + s.itens.length, 0), []);
  const [ans, setAns] = useStateR({});
  const [gpsIn, setGpsIn] = useStateR(false);
  const [saved, setSaved] = useStateR(true);
  const bodyRef = useRefR(null);

  const answeredCount = useMemoR(() => {
    let n = 0;
    SECS.forEach((s, si) => s.itens.forEach((it, ii) => {
      const a = ans[`${si}-${ii}`];
      if (!a) return;
      if (it.tipo === "Texto") { if (a.nota && a.nota.trim()) n++; }
      else if (it.tipo === "Foto") { if (a.fotos && a.fotos.length) n++; }
      else if (a.val) n++;
    }));
    return n;
  }, [ans]);

  const pct = Math.round((answeredCount / total) * 100);
  const ncCount = useMemoR(() => Object.values(ans).filter((a) => a && a.val === "no").length, [ans]);

  const setItem = (key, patch) => {
    setAns((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
    setSaved(false);
    setTimeout(() => setSaved(true), 550);
  };

  const addPhoto = (key) => {
    const cur = ans[key] || {};
    const fotos = [...(cur.fotos || []), Date.now()];
    setItem(key, { fotos });
  };
  const rmPhoto = (key, id) => {
    const cur = ans[key] || {};
    setItem(key, { fotos: (cur.fotos || []).filter((f) => f !== id) });
  };

  const allDone = answeredCount === total && gpsIn;

  return (
    <div className="m-run">
      <div className="m-run-head">
        <div className="m-run-head-top">
          <button className="m-run-back" onClick={onClose} aria-label="Voltar"><IconR name="chevronLeft" size={20} /></button>
          <div className="m-run-titles">
            <div className="m-run-code">{task.codigo} · {task.checklist}</div>
            <div className="m-run-name">{task.nome}</div>
          </div>
          <span className="m-run-save-state">
            <IconR name={saved ? "checkCircle" : "refresh"} size={13} className={saved ? "" : "spin"} />
            {saved ? "Salvo" : "Salvando"}
          </span>
        </div>
        <div className="m-run-progress">
          <div className="m-run-progress-row">
            <span>Respondidas <b>{answeredCount}</b> de <b>{total}</b></span>
            {ncCount > 0 && <span style={{ color: "var(--danger)", fontWeight: 700 }}>{ncCount} não conf.</span>}
          </div>
          <div className="m-prog-track"><i style={{ width: `${pct}%` }} /></div>
        </div>
      </div>

      <div className="m-body" ref={bodyRef}>
        {/* GPS check-in */}
        <div className={`m-gps ${gpsIn ? "is-in" : ""}`}>
          <div className="m-gps-ic"><IconR name={gpsIn ? "check" : "crosshair"} size={20} /></div>
          <div className="m-gps-main">
            <div className="m-gps-t">{gpsIn ? "Presença confirmada no local" : "Check-in georreferenciado"}</div>
            <div className="m-gps-s">
              {gpsIn
                ? `${task.lat?.toFixed(5)}, ${task.lng?.toFixed(5)} · ±6 m${online ? "" : " · salvo offline"}`
                : "Confirme que está no próprio para iniciar"}
            </div>
          </div>
          {!gpsIn && <button className="m-gps-btn" onClick={() => setGpsIn(true)}>Confirmar</button>}
        </div>

        {/* sections */}
        {SECS.map((sec, si) => (
          <div className="m-ck-sec" key={si}>
            <div className="m-ck-sec-head">
              <span className="m-ck-sec-num">{si + 1}</span>
              <span className="m-ck-sec-name">{sec.sec}</span>
              <span className="m-ck-sec-count">{sec.itens.filter((it, ii) => {
                const a = ans[`${si}-${ii}`];
                if (!a) return false;
                if (it.tipo === "Texto") return a.nota && a.nota.trim();
                if (it.tipo === "Foto") return a.fotos && a.fotos.length;
                return a.val;
              }).length}/{sec.itens.length}</span>
            </div>
            {sec.itens.map((it, ii) => {
              const key = `${si}-${ii}`;
              const a = ans[key] || {};
              return (
                <div className={`m-item ${it.tipo === "Foto" ? "m-item-photo-only" : ""}`} key={ii}>
                  <div className="m-item-q"><span className="qn">{si + 1}.{ii + 1}</span><span>{it.t}</span></div>

                  {it.tipo === "Sim/Não" && (
                    <React.Fragment>
                      <div className="m-seg">
                        <button className={`ok ${a.val === "ok" ? "is-on" : ""}`} onClick={() => setItem(key, { val: "ok" })}><IconR name="check" size={15} /> Conforme</button>
                        <button className={`no ${a.val === "no" ? "is-on" : ""}`} onClick={() => setItem(key, { val: "no" })}><IconR name="alert" size={15} /> Não conf.</button>
                        <button className={`na ${a.val === "na" ? "is-on" : ""}`} onClick={() => setItem(key, { val: "na" })}>N/A</button>
                      </div>
                      {a.val === "no" && (
                        <div className="m-nc">
                          <div className="m-nc-label"><IconR name="alert" size={12} /> Descreva a não conformidade</div>
                          <textarea className="m-ta" placeholder="O que foi encontrado? (ex.: extintor vencido desde 03/2026)"
                            value={a.nota || ""} onChange={(e) => setItem(key, { nota: e.target.value })} />
                          <div className="m-photos">
                            {(a.fotos || []).map((f) => (
                              <div className="m-photo" key={f}><IconR name="camera" size={18} /><button className="rm" onClick={() => rmPhoto(key, f)}><IconR name="x" size={11} /></button></div>
                            ))}
                            <button className="m-photo-add" onClick={() => addPhoto(key)}><IconR name="camera" size={18} /> foto</button>
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  )}

                  {it.tipo === "Texto" && (
                    <textarea className="m-ta plain" style={{ marginTop: 10 }} placeholder="Digite suas observações…"
                      value={a.nota || ""} onChange={(e) => setItem(key, { nota: e.target.value })} />
                  )}

                  {it.tipo === "Foto" && (
                    <div className="m-photos">
                      {(a.fotos || []).map((f) => (
                        <div className="m-photo" key={f}><IconR name="camera" size={18} /><button className="rm" onClick={() => rmPhoto(key, f)}><IconR name="x" size={11} /></button></div>
                      ))}
                      {(!a.fotos || !a.fotos.length)
                        ? <button className="m-photo-add" onClick={() => addPhoto(key)}><IconR name="camera" size={19} /> Tirar foto</button>
                        : <button className="m-photo-add" style={{ width: 58 }} onClick={() => addPhoto(key)}><IconR name="plus" size={18} /></button>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        <div style={{ height: 16 }} />
      </div>

      <div className="m-run-foot">
        <button className="m-run-save" disabled={!gpsIn} onClick={() => onFinish({ answeredCount, total, ncCount, online })}>
          {!gpsIn ? "Confirme o check-in para concluir"
            : allDone ? <React.Fragment><IconR name="check" size={18} /> Concluir fiscalização</React.Fragment>
            : <React.Fragment><IconR name="check" size={18} /> Concluir <span className="cnt">({answeredCount}/{total})</span></React.Fragment>}
        </button>
      </div>
    </div>
  );
}

window.ChecklistRunner = ChecklistRunner;
