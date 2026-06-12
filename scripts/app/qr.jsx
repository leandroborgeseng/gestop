// SIGMA — Chamado público via QR Code (cidadão, sem login)
const { Icon: IconQ, AndroidDevice: AndroidDeviceQ } = window;
const { useState: useStateQ } = React;

const CATS = [
  ["wrench", "Manutenção"],
  ["alert", "Risco / segurança"],
  ["pin", "Limpeza / zeladoria"],
  ["building", "Estrutura"],
  ["plug", "Elétrica / hidráulica"],
  ["more", "Outro"],
];

function ChamadoQR() {
  const [cat, setCat] = useStateQ(null);
  const [desc, setDesc] = useStateQ("");
  const [contato, setContato] = useStateQ("");
  const [fotos, setFotos] = useStateQ([]);
  const [done, setDone] = useStateQ(false);
  const valid = cat != null && desc.trim().length > 8;

  if (done) {
    return (
      <div className="qr-screen">
        <div className="qr-done">
          <div className="qr-done-ic"><IconQ name="check" size={42} /></div>
          <h2>Chamado registrado!</h2>
          <p>Recebemos sua solicitação. A equipe da Prefeitura foi notificada e vai analisar o caso.</p>
          <div className="qr-proto">CH-2026-0481</div>
          <p style={{ marginTop: 16, fontSize: 12 }}>Guarde este número para acompanhar. Se informou contato, avisaremos sobre o andamento.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="qr-screen">
      <div className="qr-top">
        <div className="qr-top-brand">
          <span className="qr-top-chip"><img className="qr-top-mark" src="assets/franca-mark.png" alt="PMF" /></span>
          <div>
            <div className="qr-top-name">Prefeitura de Franca</div>
            <div className="qr-top-sub">Canal do cidadão · SIGMA</div>
          </div>
        </div>
      </div>

      <div className="qr-unit-card">
        <div className="qr-unit-tag">Unidade identificada</div>
        <div className="qr-unit-name">EMEB Prof. Florestan Fernandes</div>
        <div className="qr-unit-meta"><IconQ name="pin" size={13} /> R. Voluntários da Franca, 1240 — Centro</div>
      </div>

      <div className="qr-body">
        <p className="qr-intro">Encontrou algum problema nesta unidade? Conte para a gente. Seu chamado vai direto para a equipe responsável.</p>

        <div className="qr-field">
          <label className="qr-label">Qual o tipo de problema?</label>
          <div className="qr-cats">
            {CATS.map(([ic, t]) => (
              <button key={t} className={`qr-cat ${cat === t ? "is-on" : ""}`} onClick={() => setCat(t)}>
                <IconQ name={ic} size={20} className="ci" />{t}
              </button>
            ))}
          </div>
        </div>

        <div className="qr-field">
          <label className="qr-label">Descreva o que está acontecendo</label>
          <textarea className="qr-ta" value={desc} onChange={(e) => setDesc(e.target.value)}
            placeholder="Ex.: O banheiro do 2º andar está com vazamento desde ontem." />
        </div>

        <div className="qr-field">
          <label className="qr-label">Foto <span className="opt">(opcional)</span></label>
          <div className="m-photos">
            {fotos.map((f) => (
              <div className="m-photo" key={f}><IconQ name="camera" size={18} /><button className="rm" onClick={() => setFotos(fotos.filter(x => x !== f))}><IconQ name="x" size={11} /></button></div>
            ))}
            {fotos.length < 3 && (
              fotos.length === 0
                ? <button className="qr-photo-add" onClick={() => setFotos([...fotos, Date.now()])}><IconQ name="camera" size={19} /> Adicionar foto</button>
                : <button className="m-photo-add" style={{ width: 60, height: 60 }} onClick={() => setFotos([...fotos, Date.now()])}><IconQ name="plus" size={18} /></button>
            )}
          </div>
        </div>

        <div className="qr-field">
          <label className="qr-label">Seu contato <span className="opt">(opcional — para receber retorno)</span></label>
          <input className="qr-input" value={contato} onChange={(e) => setContato(e.target.value)} placeholder="E-mail ou telefone" />
        </div>

        <button className="qr-submit" disabled={!valid} onClick={() => setDone(true)}>
          <IconQ name="arrowUpRight" size={17} /> Enviar chamado
        </button>

        <div className="qr-priv">
          <IconQ name="shield" size={14} />
          <span>Seus dados são tratados conforme a LGPD e usados apenas para atender este chamado. O envio é anônimo se você não informar contato.</span>
        </div>
        <div style={{ height: 16 }} />
      </div>
    </div>
  );
}

function QRRoot() {
  return (
    <div className="m-stage">
      <div className="m-stage-label"><span className="dot" /> Chamado público via QR Code — cidadão, sem login</div>
      <AndroidDeviceQ width={392} height={812}>
        <ChamadoQR />
      </AndroidDeviceQ>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<QRRoot />);
