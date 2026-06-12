// SIGMA — Auth screens: login / recuperar / redefinir senha
const { Icon: IconA } = window;
const { useState: useStateAu } = React;

function BrandPanel() {
  const points = [
    ["map", "Mapa operacional de todos os próprios públicos"],
    ["clipboard", "Fiscalizações georreferenciadas em campo, online ou offline"],
    ["shield", "Controle de não conformidades e ordens de serviço"],
  ];
  return (
    <div className="auth-brand">
      <div className="auth-brand-top">
        <span className="auth-brand-chip"><img className="auth-brand-mark" src="assets/franca-mark.png" alt="Prefeitura de Franca" /></span>
        <div>
          <div className="auth-brand-name">SIGMA</div>
          <div className="auth-brand-sub">Central Operacional · Prefeitura de Franca</div>
        </div>
      </div>
      <div className="auth-hero">
        <h1>Gestão operacional do patrimônio público</h1>
        <p>Monitore, fiscalize e mantenha escolas, unidades de saúde, praças e prédios — tudo em um só lugar, em tempo real.</p>
        <div className="auth-points">
          {points.map(([ic, t]) => (
            <div className="auth-point" key={t}><span className="ap-ic"><IconA name={ic} size={17} /></span>{t}</div>
          ))}
        </div>
      </div>
      <div className="auth-foot"><IconA name="shield" size={14} /> Acesso restrito · Servidores e agentes autorizados · LGPD</div>
    </div>
  );
}

function LoginForm({ go, sessionExpired }) {
  const [email, setEmail] = useStateAu("ricardo.campos@franca.sp.gov.br");
  const [pw, setPw] = useStateAu("");
  const [show, setShow] = useStateAu(false);
  const [loading, setLoading] = useStateAu(false);
  const [error, setError] = useStateAu("");

  const submit = (e) => {
    e.preventDefault();
    setError("");
    if (!email || !pw) { setError("Informe e-mail e senha para continuar."); return; }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      if (pw.length < 4) { setError("E-mail ou senha incorretos. Verifique e tente novamente."); return; }
      window.location.href = "SIGMA - CCO.html";
    }, 1400);
  };

  return (
    <div className="auth-card">
      <div className="auth-card-head">
        <div className="auth-kicker">Acesso ao sistema</div>
        <h2>Entrar no SIGMA</h2>
        <p>Use suas credenciais institucionais da Prefeitura de Franca.</p>
      </div>
      <form className="auth-form" onSubmit={submit}>
        {sessionExpired && !error && (
          <div className="auth-notice"><IconA name="clock" size={16} /> Sua sessão expirou por inatividade. Entre novamente para continuar.</div>
        )}
        {error && <div className="auth-error"><IconA name="alert" size={16} /> {error}</div>}
        <div>
          <label className="qr-label" htmlFor="email">E-mail institucional</label>
          <div className="auth-input-wrap">
            <IconA name="user" size={17} />
            <input id="email" className="auth-input" type="email" value={email} autoComplete="username"
              onChange={(e) => setEmail(e.target.value)} placeholder="nome@franca.sp.gov.br" />
          </div>
        </div>
        <div>
          <label className="qr-label" htmlFor="pw">Senha</label>
          <div className="auth-input-wrap">
            <IconA name="shield" size={17} />
            <input id="pw" className={`auth-input ${error ? "err" : ""}`} type={show ? "text" : "password"} value={pw}
              autoComplete="current-password" onChange={(e) => setPw(e.target.value)} placeholder="••••••••" />
            <button type="button" className="auth-eye" onClick={() => setShow(!show)} aria-label="Mostrar senha">
              <IconA name={show ? "pinOff" : "search"} size={16} />
            </button>
          </div>
        </div>
        <div className="auth-row">
          <label className="auth-check"><input type="checkbox" defaultChecked /> Manter conectado</label>
          <button type="button" className="auth-link" onClick={() => go("recuperar")}>Esqueci minha senha</button>
        </div>
        <button className="auth-submit" type="submit" disabled={loading}>
          {loading ? <React.Fragment><IconA name="refresh" size={17} className="spin" /> Entrando…</React.Fragment>
            : <React.Fragment>Entrar <IconA name="arrowUpRight" size={16} /></React.Fragment>}
        </button>
      </form>
    </div>
  );
}

function RecuperarForm({ go }) {
  const [email, setEmail] = useStateAu("");
  const [sent, setSent] = useStateAu(false);
  const [loading, setLoading] = useStateAu(false);
  const submit = (e) => { e.preventDefault(); setLoading(true); setTimeout(() => { setLoading(false); setSent(true); }, 1200); };

  if (sent) {
    return (
      <div className="auth-card">
        <div className="auth-success-ic"><IconA name="inbox" size={30} /></div>
        <div className="auth-card-head">
          <h2>Verifique seu e-mail</h2>
          <p>Se houver uma conta vinculada a <b>{email || "esse endereço"}</b>, enviamos um link para redefinir a senha. O link expira em 30 minutos.</p>
        </div>
        <button className="auth-submit" onClick={() => go("redefinir")}>Já recebi o link</button>
        <button className="auth-back" onClick={() => go("login")}><IconA name="chevronLeft" size={15} /> Voltar ao login</button>
      </div>
    );
  }
  return (
    <div className="auth-card">
      <div className="auth-card-head">
        <div className="auth-kicker">Recuperação</div>
        <h2>Recuperar senha</h2>
        <p>Informe seu e-mail institucional e enviaremos instruções para redefinir o acesso.</p>
      </div>
      <form className="auth-form" onSubmit={submit}>
        <div>
          <label className="qr-label" htmlFor="r-email">E-mail institucional</label>
          <div className="auth-input-wrap">
            <IconA name="user" size={17} />
            <input id="r-email" className="auth-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@franca.sp.gov.br" />
          </div>
        </div>
        <button className="auth-submit" type="submit" disabled={loading}>
          {loading ? <React.Fragment><IconA name="refresh" size={17} className="spin" /> Enviando…</React.Fragment> : "Enviar link de recuperação"}
        </button>
        <button type="button" className="auth-back" onClick={() => go("login")}><IconA name="chevronLeft" size={15} /> Voltar ao login</button>
      </form>
    </div>
  );
}

function RedefinirForm({ go }) {
  const [pw, setPw] = useStateAu("");
  const [pw2, setPw2] = useStateAu("");
  const [done, setDone] = useStateAu(false);
  const strength = pw.length === 0 ? 0 : pw.length < 6 ? 1 : pw.length < 10 ? 2 : 3;
  const match = pw && pw === pw2;
  const submit = (e) => { e.preventDefault(); if (strength >= 2 && match) setDone(true); };

  if (done) {
    return (
      <div className="auth-card">
        <div className="auth-success-ic"><IconA name="check" size={32} /></div>
        <div className="auth-card-head">
          <h2>Senha redefinida</h2>
          <p>Sua nova senha foi salva com segurança. Você já pode entrar no SIGMA.</p>
        </div>
        <button className="auth-submit" onClick={() => go("login")}>Ir para o login</button>
      </div>
    );
  }
  return (
    <div className="auth-card">
      <div className="auth-card-head">
        <div className="auth-kicker">Nova senha</div>
        <h2>Redefinir senha</h2>
        <p>Crie uma nova senha com pelo menos 8 caracteres, incluindo letras e números.</p>
      </div>
      <form className="auth-form" onSubmit={submit}>
        <div>
          <label className="qr-label" htmlFor="np">Nova senha</label>
          <div className="auth-input-wrap">
            <IconA name="shield" size={17} />
            <input id="np" className="auth-input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Digite a nova senha" />
          </div>
          <div className="pw-meter" style={{ marginTop: 8 }}>
            <i className={strength >= 1 ? `on${strength}` : ""} /><i className={strength >= 2 ? `on${strength}` : ""} /><i className={strength >= 3 ? `on${strength}` : ""} />
          </div>
          <div className="pw-hint" style={{ marginTop: 5 }}>{["", "Fraca — use mais caracteres", "Razoável", "Forte"][strength]}</div>
        </div>
        <div>
          <label className="qr-label" htmlFor="np2">Confirmar senha</label>
          <div className="auth-input-wrap">
            <IconA name="shield" size={17} />
            <input id="np2" className={`auth-input ${pw2 && !match ? "err" : ""}`} type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Repita a nova senha" />
          </div>
          {pw2 && !match && <div className="pw-hint" style={{ color: "var(--danger)", marginTop: 5 }}>As senhas não coincidem.</div>}
        </div>
        <button className="auth-submit" type="submit" disabled={!(strength >= 2 && match)}>Salvar nova senha</button>
        <button type="button" className="auth-back" onClick={() => go("login")}><IconA name="chevronLeft" size={15} /> Voltar ao login</button>
      </form>
    </div>
  );
}

function AuthApp() {
  const [screen, setScreen] = useStateAu("login");
  return (
    <div className="auth">
      <BrandPanel />
      <div className="auth-panel">
        {screen === "login" && <LoginForm go={setScreen} sessionExpired={false} />}
        {screen === "recuperar" && <RecuperarForm go={setScreen} />}
        {screen === "redefinir" && <RedefinirForm go={setScreen} />}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<AuthApp />);
