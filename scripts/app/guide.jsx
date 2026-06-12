// SIGMA — Guia contextual ("manual em tempo real")
const { Icon: IconG, IconButton: IconButtonG, Button: ButtonG } = window;
const { useState: useStateG, useEffect: useEffectG } = React;

const GUIDE = {
  cco: {
    nome: "CCO — Central de Controle Operacional",
    resumo: "Monitore todos os próprios públicos num só lugar. O mapa e a lista estão sincronizados: filtrar, buscar ou selecionar em um reflete imediatamente no outro.",
    comoFazer: [
      { t: "Encontrar um próprio", s: ["Digite na busca o nome ou o código (ex.: PMF-ESC-001).", "Ou combine os filtros de secretaria, bairro, tipo e situação.", "A lista e o mapa se atualizam juntos — o contador mostra quantos restaram."] },
      { t: "Ver tudo sobre uma unidade", s: ["Clique numa linha da lista ou num marcador do mapa.", "Abre o painel com fiscalizações, não conformidades e ordens de serviço.", "Use as abas para navegar entre cada tipo de registro."] },
      { t: "Focar no que exige ação", s: ["Clique no card 'Pendências abertas' para ver só os próprios com problemas.", "No mapa, marcadores âmbar = com pendências; verdes = operacionais."] },
      { t: "Registrar uma fiscalização", s: ["Botão 'Nova fiscalização' no topo da página.", "Ou abra a unidade e use 'Nova fiscalização' dentro do painel."] },
    ],
    glossario: [
      { k: "Situação", v: "Estado operacional do próprio: Operacional, Com pendências, Sem localização ou Inativa." },
      { k: "NC — Não conformidade", v: "Item reprovado durante uma fiscalização (ex.: extintor vencido)." },
      { k: "OS — Ordem de serviço", v: "Tarefa de manutenção gerada a partir de uma NC ou de um chamado." },
      { k: "Sem GPS", v: "Próprio ainda não georreferenciado — aparece na lista, mas não no mapa." },
    ],
  },
  dashboard: {
    nome: "Dashboard",
    resumo: "Panorama do dia: indicadores, alertas que exigem ação, envio de avisos push para o campo e auditoria recente. Use os 'Links rápidos' para saltar direto à ação.",
    comoFazer: [
      { t: "Priorizar o que está em risco", s: ["O card 'SLA em risco' mostra OS perto de vencer.", "Os 'Alertas operacionais' destacam o que precisa de você agora."] },
      { t: "Avisar a equipe de campo", s: ["No painel de notificações push, escreva o aviso.", "Escolha o público (todos ou por secretaria) e envie."] },
    ],
    glossario: [
      { k: "SLA", v: "Prazo acordado para concluir uma OS. 'Em risco' = perto de vencer." },
      { k: "Auditoria", v: "Registro de quem fez o quê e quando — rastreabilidade LGPD." },
    ],
  },
  chamados: {
    nome: "Chamados",
    resumo: "Fila de chamados abertos por cidadãos (QR Code), agentes (app) ou telefone. Triagem, encaminhamento para OS, resolução e cancelamento — tudo num só lugar.",
    comoFazer: [
      { t: "Triar um chamado novo", s: ["Selecione um chamado 'Aberto' na lista.", "Clique em 'Iniciar triagem' para classificá-lo.", "Se exigir manutenção, use 'Encaminhar para OS'."] },
      { t: "Filtrar a fila", s: ["Use os chips de status no topo (Aberto, Em triagem…).", "Busque por título, código ou unidade."] },
    ],
    glossario: [
      { k: "Canal", v: "Como o chamado chegou: QR Code, App de campo ou Telefone." },
      { k: "Encaminhar para OS", v: "Transforma o chamado em ordem de serviço de manutenção." },
    ],
  },
  os: {
    nome: "Ordens de serviço",
    resumo: "Toda OS tem prazo, responsável, origem (NC ou chamado) e uma linha do tempo de execução. Filtre por status e prioridade para focar no urgente.",
    comoFazer: [
      { t: "Acompanhar uma OS", s: ["Selecione a OS na lista.", "Veja prazo, responsável e a linha do tempo à direita.", "Use 'Atualizar status' conforme a execução avança."] },
      { t: "Achar o que vence primeiro", s: ["Prazos em vermelho estão vencidos ou vencem hoje.", "Filtre por prioridade URGENTE para o crítico."] },
    ],
    glossario: [
      { k: "Origem", v: "De onde nasceu a OS: uma não conformidade (NC) ou um chamado." },
      { k: "Prazo / SLA", v: "Data limite para conclusão. Vermelho = atenção imediata." },
    ],
  },
  admin: {
    nome: "Administração",
    resumo: "Cadastros de secretarias, próprios e usuários, além dos controles de LGPD. Use as abas para alternar entre cada tipo de registro.",
    comoFazer: [
      { t: "Cadastrar ou editar um registro", s: ["Escolha a aba (Secretarias, Unidades ou Usuários).", "Clique em 'Novo registro' ou na engrenagem da linha para editar.", "Preencha o formulário e salve."] },
      { t: "Aplicar a LGPD", s: ["Use 'Anonimizar' para mascarar dados pessoais de um cidadão.", "A purga de auditoria remove registros antigos conforme a política."] },
    ],
    glossario: [
      { k: "RBAC", v: "Controle de acesso por papel — define o que cada perfil enxerga e faz." },
      { k: "Anonimizar", v: "Substituir dados pessoais por valores não identificáveis (LGPD)." },
    ],
  },
  checklists: {
    nome: "Checklists",
    resumo: "Modelos de fiscalização aplicados pelos agentes em campo. Cada modelo tem versões — publique novas sem quebrar o histórico das fiscalizações já feitas.",
    comoFazer: [
      { t: "Editar um modelo", s: ["Selecione o modelo na lista para abrir o editor.", "Adicione, reordene ou remova itens e defina o tipo de resposta.", "Publique para gerar uma nova versão."] },
      { t: "Entender as versões", s: ["Fiscalizações antigas mantêm a versão usada na época.", "Novas fiscalizações usam a versão publicada mais recente."] },
    ],
    glossario: [
      { k: "Item", v: "Pergunta do checklist. Tipos: Sim/Não, Texto ou Foto." },
      { k: "Versão", v: "Fotografia do modelo num momento — garante rastreabilidade." },
    ],
  },
  relatorios: {
    nome: "Relatórios",
    resumo: "Exportações por tipo e período. CSV para análise em planilha; PDF para registro oficial. Filtre por período e secretaria antes de exportar.",
    comoFazer: [
      { t: "Exportar dados", s: ["Defina período, secretaria e formato no topo.", "Escolha o conjunto (próprios, fiscalizações, OS, chamados).", "Clique em CSV ou PDF na linha desejada."] },
    ],
    glossario: [
      { k: "CSV", v: "Arquivo de planilha para análise e cruzamento de dados." },
      { k: "PDF (registro)", v: "Documento formatado para arquivo e prestação de contas." },
    ],
  },
  integracoes: {
    nome: "Integrações",
    resumo: "Status técnico dos serviços conectados: webhooks, sincronização do app de campo e espelho do patrimônio. Acompanhe a saúde de cada conexão e reprocesse falhas.",
    comoFazer: [
      { t: "Resolver uma fila travada", s: ["Identifique a integração com status 'Atenção'.", "Use 'Retry' para reprocessar os eventos pendentes.", "Confira o último evento e a contagem para validar."] },
    ],
    glossario: [
      { k: "Webhook", v: "Aviso automático enviado a outro sistema quando algo acontece." },
      { k: "Fila / Retry", v: "Eventos aguardando envio; Retry tenta processá-los de novo." },
    ],
  },
  conta: {
    nome: "Minha conta",
    resumo: "Seus dados de acesso, segurança e sessões ativas. Altere sua senha periodicamente para manter o acesso seguro.",
    comoFazer: [
      { t: "Alterar a senha", s: ["Informe a senha atual.", "Defina uma nova com pelo menos 8 caracteres, número e símbolo.", "Confirme e salve."] },
    ],
    glossario: [
      { k: "Sessão", v: "Cada dispositivo conectado à sua conta. Encerre as que não reconhecer." },
    ],
  },
  unidade: {
    nome: "Detalhe da unidade",
    resumo: "Tudo sobre um próprio: dados patrimoniais, localização, histórico de fiscalizações, não conformidades e ordens de serviço. Aja direto daqui.",
    comoFazer: [
      { t: "Navegar pelos registros", s: ["Use as abas para alternar entre fiscalizações, NCs e OS.", "Cada item mostra data, responsável e status."] },
      { t: "Tomar ação", s: ["'Nova fiscalização' inicia um checklist para esta unidade.", "'Abrir OS' cria uma ordem de manutenção vinculada."] },
    ],
    glossario: [
      { k: "Matrícula patrimonial", v: "Identificador do bem no cadastro de patrimônio do município." },
      { k: "NC → OS", v: "Uma não conformidade pode virar ordem de serviço para correção." },
    ],
  },
  _default: {
    nome: "SIGMA",
    resumo: "Esta seção faz parte do redesign completo. O guia contextual acompanha você em cada tela com o que ela faz e como agir.",
    comoFazer: [{ t: "Voltar ao centro de comando", s: ["A CCO concentra mapa, indicadores e a lista de próprios.", "Use o menu lateral para navegar entre as áreas."] }],
    glossario: [
      { k: "Próprio público", v: "Bem do município sob gestão: escola, UBS, praça, prédio." },
      { k: "Secretaria", v: "Órgão responsável pelo próprio (SME, SMS, SMOSP…)." },
    ],
  },
};

const ATALHOS = [
  { k: "/", d: "Buscar em qualquer tela" },
  { k: "?", d: "Abrir / fechar este guia" },
  { k: "Esc", d: "Fechar painéis abertos" },
];

function HowTo({ item }) {
  const [open, setOpen] = useStateG(false);
  return (
    <div className={`howto ${open ? "is-open" : ""}`}>
      <button className="howto-head" onClick={() => setOpen(!open)}>
        <span className="howto-t">{item.t}</span>
        <IconG name="chevronDown" size={16} className="howto-caret" />
      </button>
      {open && (
        <ol className="howto-steps">
          {item.s.map((s, i) => <li key={i}>{s}</li>)}
        </ol>
      )}
    </div>
  );
}

function GuidePanel({ route, onClose }) {
  const g = GUIDE[route] || GUIDE._default;
  return (
    <React.Fragment>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="guide" role="dialog" aria-label="Guia SIGMA">
        <header className="guide-head">
          <div className="guide-head-row">
            <div className="guide-badge"><IconG name="fileText" size={18} /></div>
            <div>
              <div className="guide-title">Guia SIGMA</div>
              <div className="guide-subtitle">Manual em tempo real</div>
            </div>
            <IconButtonG icon="x" label="Fechar guia" onClick={onClose} className="guide-close" />
          </div>
          <div className="guide-where"><IconG name="pin" size={13} /> Você está em <b>{g.nome}</b></div>
        </header>

        <div className="guide-body">
          <section className="guide-sec">
            <div className="guide-sec-title">Nesta tela</div>
            <p className="guide-resumo">{g.resumo}</p>
          </section>

          <section className="guide-sec">
            <div className="guide-sec-title">Como fazer</div>
            <div className="howto-list">
              {g.comoFazer.map((it, i) => <HowTo key={i} item={it} />)}
            </div>
          </section>

          <section className="guide-sec">
            <div className="guide-sec-title">Glossário</div>
            <dl className="gloss">
              {g.glossario.map((it, i) => (
                <div key={i} className="gloss-item">
                  <dt>{it.k}</dt><dd>{it.v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="guide-sec">
            <div className="guide-sec-title">Atalhos de teclado</div>
            <div className="atalhos">
              {ATALHOS.map((a, i) => (
                <div key={i} className="atalho"><kbd>{a.k}</kbd><span>{a.d}</span></div>
              ))}
            </div>
          </section>

          <div className="guide-foot">
            <IconG name="shield" size={15} />
            <span>Dúvidas operacionais? Acione o suporte da CCO pelo ramal <b>2200</b>.</span>
          </div>
        </div>
      </aside>
    </React.Fragment>
  );
}

// Dismissible inline tip (persisted)
function TipBanner({ id, icon, children }) {
  const key = `gestop_tip_${id}`;
  const [show, setShow] = useStateG(() => {
    try { return localStorage.getItem(key) !== "1"; } catch (e) { return true; }
  });
  if (!show) return null;
  const dismiss = () => { try { localStorage.setItem(key, "1"); } catch (e) {} setShow(false); };
  return (
    <div className="tip-banner">
      <div className="tip-icon"><IconG name={icon || "fileText"} size={15} /></div>
      <div className="tip-text">{children}</div>
      <button className="tip-dismiss" onClick={dismiss}>Entendi</button>
      <button className="tip-x" onClick={dismiss} aria-label="Dispensar"><IconG name="x" size={14} /></button>
    </div>
  );
}

// Small inline help "?" with tooltip
function Hint({ text }) {
  return (
    <span className="hint" tabIndex={0}>
      <IconG name="alert" size={0} />
      <span className="hint-q">?</span>
      <span className="hint-pop">{text}</span>
    </span>
  );
}

Object.assign(window, { GuidePanel, TipBanner, Hint });
