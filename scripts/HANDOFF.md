# SIGMA — Handoff de implementação (para o Cursor)

> Redesign completo da interface. Este pacote contém **protótipos HTML/React interativos** + **design tokens** + **specs de componentes** + **checklist de arquivos a alterar** no repo Next.js (`frontend/`).
> Stack alvo: Next.js 16 · React 19 · Tailwind CSS 4 · Lucide · Leaflet. Idioma pt-BR. Light mode.

---

## 0. Como o Cursor deve usar este pacote

1. Comece pelos **tokens** (seção 2) → cole em `frontend/app/globals.css`.
2. Aplique o **AppShell** (seção 4) e os **componentes base** (seção 3) — não reinvente, evolua os existentes em `components/ui/`.
3. Implemente tela a tela seguindo a seção 6, na ordem sugerida: **tokens → shell → login → CCO → demais**.
4. **Não** altere contratos de API (`lib/api.ts`), rotas URL, nem o RBAC. Só a camada de UI.
5. Os arquivos de referência visual estão neste pacote (ver seção 1). Abra os `.html` no navegador para ver o comportamento exato (hover, estados, transições).

---

## 1. Conteúdo do pacote (protótipos de referência)

| Arquivo | O que demonstra |
|---|---|
| `SIGMA - Protótipos.html` | Hub que linka tudo |
| `SIGMA - CCO.html` | App web completo (CCO + todas as telas autenticadas). É a fonte de verdade visual do desktop |
| `SIGMA - Campo Mobile.html` | PWA do agente de campo (offline-first) |
| `SIGMA - Chamado QR.html` | Chamado público do cidadão (sem login) |
| `SIGMA - Acesso.html` | Login + recuperar/redefinir senha |
| `app/styles.css` | **Todos os tokens + classes** (fonte dos valores abaixo) |
| `app/*.jsx` | Componentes React de referência (CCO, drawer, shell, ui, guide, mobile, auth, etc.) |
| `assets/franca-mark.png` | Marca da Prefeitura (cata-vento) já recortada |

> Os protótipos usam React 18 + Babel no browser **apenas para prototipar**. No repo, porte a lógica para componentes `.tsx` reais. O CSS/tokens é direto.

---

## 2. Design tokens (colar em `globals.css`)

Mantém o azul PMF `#0066CC`, escala refinada. Cores frias (slate) para neutros — sensação gov-tech, não “Material genérico”.

```css
:root {
  /* Marca */
  --brand: #0066CC;          /* primária: botões, links, nav ativo */
  --brand-hover: #005BB5;    /* hover */
  --brand-bright: #1E7BD6;   /* acento / dados secundários */
  --brand-soft: #E8F1FC;     /* fundo tonal (chips, nav ativo, ícones) */

  /* Neutros (cool slate) */
  --canvas: #F3F6FB;         /* fundo da aplicação */
  --surface: #FFFFFF;        /* cards, painéis */
  --surface-2: #FAFBFD;      /* fundo sutil / hover de linhas */
  --ink: #0F1B2D;            /* texto principal */
  --ink-2: #36465B;          /* texto secundário forte */
  --ink-3: #647389;          /* texto secundário / descrições */
  --ink-4: #97A3B6;          /* texto terciário / placeholders */
  --line: #E5EAF1;           /* bordas */
  --line-2: #EEF2F8;         /* divisores sutis */

  /* Semânticas (texto / fundo / borda) */
  --ok: #15924E;   --ok-bg: #E5F4EB;   --ok-bd: #BFE4CD;     /* operacional / sucesso */
  --warn: #B5680A; --warn-bg: #FBF0DD; --warn-bd: #F0D8AE;   /* pendências / atenção */
  --danger: #D62B2B; --danger-bg: #FBE9E9; --danger-bd: #F2C9C9; /* crítico / erro */
  --muted: #5B6B82;  --muted-bg: #EDF1F6;                    /* neutro / sem GPS */
  --off: #8A97A8;                                            /* inativa */

  /* Raio */
  --r-card: 14px; --r-md: 10px; --r-sm: 8px; --r-pill: 999px;

  /* Elevação */
  --sh-sm: 0 1px 2px rgba(15,27,45,.06), 0 1px 1px rgba(15,27,45,.03);
  --sh-md: 0 6px 22px -8px rgba(15,27,45,.14), 0 2px 6px -2px rgba(15,27,45,.06);
  --sh-lg: 0 22px 54px -16px rgba(15,27,45,.28);

  /* Layout shell */
  --sb-w: 264px; --sb-w-collapsed: 74px; --topbar-h: 60px;

  /* Densidade (3 níveis — opcional, via atributo data-density no <html>) */
  --row-py: 11px; --kpi-py: 16px; --content-px: 26px;

  --font: "IBM Plex Sans", system-ui, -apple-system, Segoe UI, sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
}
[data-density="compact"] { --row-py: 8px;  --kpi-py: 12px; --content-px: 20px; }
[data-density="comfy"]   { --row-py: 15px; --kpi-py: 22px; --content-px: 34px; }
```

### Equivalente Tailwind 4 (`@theme inline`)
```css
@theme inline {
  --color-brand: var(--brand);
  --color-brand-hover: var(--brand-hover);
  --color-brand-bright: var(--brand-bright);
  --color-brand-soft: var(--brand-soft);
  --color-canvas: var(--canvas);
  --color-surface: var(--surface);
  --color-ink: var(--ink);
  --color-ink-2: var(--ink-2);
  --color-ink-3: var(--ink-3);
  --color-line: var(--line);
  --color-ok: var(--ok);  --color-warn: var(--warn);  --color-danger: var(--danger);
  --radius-card: var(--r-card);
  --font-sans: var(--font);
  --font-mono: var(--mono);
}
```

---

## 3. Tipografia

- **Família:** `IBM Plex Sans` (UI) + `IBM Plex Mono` (códigos, IDs, números/telemetria). Substitui Inter — mais institucional e legível, foge do clichê. Importar do Google Fonts (pesos 400/500/600/700 sans; 500/600 mono).
- **Números sempre em mono** com `font-feature-settings: "tnum" 1` (KPIs, códigos PMF-xxx, OS-2026-xxxx, prazos, coordenadas).
- Escala em uso:

| Nível | Tamanho / peso | Uso |
|---|---|---|
| Page title | 23px / 700 / -.025em | título da página |
| Kicker | 11.5px / 600 / .07em / uppercase / brand | sobre-título |
| Section | 11px / 700 / uppercase / ink-4 | títulos de grupo |
| Body | 13.5–14px / 400-500 | corpo |
| KPI value | 30px / 600 mono | métricas |
| Meta | 11.5–12px / ink-3 | descrições |

Mínimo de toque mobile: **44px**. Texto nunca abaixo de 11px.

---

## 4. AppShell (layout)

**Desktop (≥1024px):** sidebar fixa `264px` (colapsável p/ `74px`) + topbar `60px` + conteúdo.
- **Sidebar:** logo PMF (marca + “SIGMA / Central Operacional”) → nav agrupada (Operação / Gestão / Configuração) → rodapé (usuário + Sair). Item ativo: fundo `--brand-soft`, texto `--brand-hover`, barra de 3px `--brand` à esquerda. Badges de contagem em mono. Filtrar itens por RBAC (mantido).
- **Topbar:** busca global (atalho `/`) + pílulas de estado **Online** e **Sync pendentes** + botão **Guia** (atalho `?`) + sino + preferências.
- **PageShell:** kicker + título + descrição + slot de ações à direita (botões).

**Mobile (<1024px):** app bar + bottom nav (4 itens + “Mais” em sheet). Ver `SIGMA - Campo Mobile.html`.

Arquivos: `components/layout/app-shell.tsx`, `page-shell.tsx`, `lib/navigation.ts`.

---

## 5. Componentes (evoluir `components/ui/*`)

Specs resumidas — anatomia completa nas classes de `app/styles.css` e no JSX de `app/ui.jsx`.

- **Button** — `height: 38px` (md) / `32px` (sm), `radius 10px`, `font 13.5px/600`, `gap 7px` p/ ícone. Variantes: `filled` (brand/branco), `tonal` (brand-soft), `outlined`, `ghost`, `danger`. Hover escurece.
- **IconButton** — 36px quadrado, radius 10px, hover `surface-2`.
- **StatusBadge** — pílula com dot. Papéis: `ok` (operacional), `warn` (pendências), `muted` (sem GPS), `off` (inativa). Fundo = `*-bg`, texto/dot = cor.
- **Badge** — pílula sólida pequena (prioridades, status de OS/chamado): tons `neutral/info/warn/danger/ok`.
- **Chip** — filtro togglável; ativo = fundo `--brand`, branco; suporta `count` (mono) e `dot`.
- **Field / Input / Select / SearchInput** — altura 36–38px, radius 10px, foco com `box-shadow 0 0 0 3px var(--brand-soft)` + borda brand. Select com caret próprio.
- **MetricCard (KPI)** — ícone tonal 38px + label + valor mono 30px + delta + sub. Clicável vira filtro (estado `is-active` com anel brand).
- **Tabs** — sublinhado animado na aba ativa; `count` em mono.
- **Table** — usada em Admin; cabeçalho `ink-3`, linhas com divisor `line-2`.
- **Drawer / Sheet** — drawer lateral 420px (desktop) e sheet inferior (mobile), scrim `rgba(15,27,45,.28)`, animação slide.
- **Toast/Snackbar** — `--ink` escuro, canto/centro inferior, auto-some em ~2.6s.
- **FAB** — mobile, sync; pílula brand com badge de contagem.

---

## 6. Telas (notas de implementação)

**CCO (`/cco`) — prioritária.** 4 KPIs (clicáveis = filtro) + mapa Leaflet + painel de filtros + lista. **Mapa e lista são sincronizados**: filtro/busca/seleção em um reflete no outro; hover na lista destaca o pin; clique abre o drawer da unidade. Marcadores coloridos por situação (pin “gota”).
- **NOVO — toggle Mapa/Satélite** no mapa (ver seção 7).

**Detalhe da unidade (`/cco/unidades/[id]`)** — header + abas (visão geral, fiscalizações, NCs, OS) + metadados patrimoniais. Existe como drawer e como página cheia.

**Campo PWA (`/mobile`)** — offline-first. Roteiro por proximidade → check-in GPS → checklist (Sim/Não/N-A com toques ≥46px; “Não conf.” revela nota + foto; tipos Texto e Foto) → conclusão. **Estado de conexão alternável**; conclusões offline vão para a **fila de sincronização** (FAB com contagem) e enviam ao reconectar. Salvar local automático (“Salvo”).

**Chamados (`/chamados`)** — chips de status com contagem + lista + painel de detalhe com ações de fluxo (Iniciar triagem → Encaminhar para OS → Resolver/Cancelar) + toast.

**Ordens de serviço (`/ordens-servico`)** — lista (prazo colorido por urgência) + detalhe com **timeline de status** + ações (Atualizar status avança o fluxo; Concluir OS). Origem = NC ou chamado.

**Dashboard (`/dashboard`)** — KPIs + alertas operacionais + push p/ campo + auditoria recente + links rápidos.

**Admin (`/admin`)** — abas Secretarias/Unidades/Usuários (tabela + CRUD) + LGPD (anonimizar, purga auditoria).

**Checklists (`/checklists` + editor)** — modelos versionados (publicar sem quebrar histórico).

**Relatórios / Integrações / Conta** — export CSV/PDF por período; status de webhooks/sync com Retry; alterar senha.

**Login + recuperar/redefinir** — split layout (painel marca gradiente + card form). Estados: loading, erro, sessão expirada, força de senha.

**Chamado QR (`/chamado/[codigo]`)** — cidadão, sem login: unidade identificada, categorias visuais, descrição, foto e contato opcionais, protocolo + aviso LGPD.

---

## 7. NOVO — Mapa com Mapa/Satélite (`components/operational-map.tsx`)

Adicionar um toggle sobre o mapa (segmented “Mapa | Satélite”). Tiles:

```js
// Mapa (claro, sem labels) — CARTO Voyager
"https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png"  // subdomains: "abcd"
// (variante escura opcional): .../dark_all/...

// Satélite — Esri World Imagery (sem chave)
"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
// + overlay de nomes de ruas por cima da imagem:
"https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png"  // subdomains: "abcd"
```

Ao trocar de view: remover a tile layer atual (e a de labels) e adicionar a nova. Implementação de referência em `app/cco.jsx` (`MapPanel`) e `app/mobile.jsx` (`MccoScreen`). Verifique atribuição/uso do Esri para produção.

---

## 8. NOVO — Manual em tempo real (sistema auto-explicativo)

Pedido-chave do cliente: a interface deve ser **auto-explicativa**, com ajuda sempre à mão. Implementado como:

1. **Painel Guia contextual** — botão “Guia” na topbar (+ tecla `?`). Abre um drawer com conteúdo **que muda conforme a rota atual**: “Nesta tela”, “Como fazer” (passo a passo em sanfona) e “Glossário”. Conteúdo por rota em `app/guide.jsx` (objeto `GUIDE`). No mobile, ícone no app bar + item em “Mais”.
2. **TipBanner** — dica inline dispensável e persistida (localStorage) em pontos-chave (ex.: “mapa e lista trabalham juntos”).
3. **Hint** — tooltip “?” inline para termos pontuais.

Sugestão de repo: criar `components/help/guide-panel.tsx` + um `lib/guide-content.ts` (mapa rota→conteúdo) + provider para abrir/fechar com atalho.

---

## 9. Checklist de arquivos a alterar no repo

```
frontend/app/globals.css                 ← tokens (seção 2) + import IBM Plex
frontend/app/layout.tsx                   ← trocar fonte Inter → IBM Plex Sans/Mono
frontend/components/ui/button.tsx         ← variantes/alturas (seção 5)
frontend/components/ui/{badge,chip,status-badge}.tsx
frontend/components/ui/{input,select,field}.tsx ← foco brand-soft
frontend/components/ui/{card,tabs,table,sheet,fab,snackbar}.tsx
frontend/components/ui/metric-card.tsx    ← KPI clicável
frontend/components/layout/app-shell.tsx  ← sidebar agrupada + topbar (Online/Sync/Guia)
frontend/components/layout/page-shell.tsx ← kicker+título+desc+ações
frontend/components/operational-map.tsx   ← toggle Mapa/Satélite (seção 7)
frontend/components/unidade-{filters,list}.tsx ← sync mapa↔lista
frontend/components/checklist-item-card.tsx ← toques grandes, NC revela foto
frontend/components/help/guide-panel.tsx  ← NOVO manual em tempo real (seção 8)
frontend/lib/navigation.ts                ← grupos de menu
frontend/lib/guide-content.ts             ← NOVO conteúdo do guia por rota
```

**Breaking changes evitados:** rotas URL, contratos `/api-gestop/*`, RBAC (`RequirePermissions`) e fluxo de auth permanecem intactos — mudança é só de UI/estilo.

---

## 10. Ordem de implementação sugerida
1. Tokens + fonte (globals.css, layout.tsx)
2. Componentes base (button, badge, input, card…)
3. AppShell (sidebar + topbar + page-shell)
4. Login
5. CCO (mapa + sync + drawer + satélite)
6. Demais telas
7. Manual em tempo real (guide-panel) — transversal
