# SIGMA — Especificação de Front-end (Design System)

> Documento técnico para geração e manutenção de UI no projeto **SIGMA — Gestão de Ordens de Serviço e Fiscalização Georreferenciada** — Prefeitura Municipal de Franca.
>
> Baseado em Next.js, React, Tailwind CSS, tokens CSS próprios e alinhado ao **Prefeitura de Franca Design System** (`franca-design-system`).

---

## Meta

| Campo | Valor |
|-------|--------|
| **Nome** | SIGMA Front-end Design System Spec |
| **Versão** | 1.0.0 |
| **Atualizado em** | 2026-05-18 |
| **Idioma** | pt-BR |
| **Stack** | Next.js 14 · React 18 · Tailwind CSS · CSS custom properties |
| **Arquivo de tokens CSS** | `frontend/app/portal-ds.css` |
| **Tema ativo na aplicação logada** | `servicePortal` (`data-theme="servicePortal"`) |

### Convenção de confiança

- **confirmed** — valor confirmado no código ou CSS do repositório.
- **inferred** — valor inferido por padrão do ecossistema Franca ou boas práticas.

---

## Contextos visuais

O SIGMA usa **dois contextos** do design system municipal, mais uma **tela de login** com estilo próprio.

| ID | Uso no SIGMA | Onde |
|----|----------------|------|
| `legacyPortal` | Portal institucional legado (tokens em `:root`) | Herança / compatibilidade |
| `servicePortal` | Carta de Serviços — **tema principal logado** | `CcoApp`, painéis, formulários, PWA |
| `loginStandalone` | Login / alterar senha / esqueci senha | `LoginScreen` (Tailwind, sem `portal-ds.css`) |

```html
<!-- Aplicação principal (após login) -->
<main class="iptu-app-shell" data-theme="servicePortal">
```

---

## Fundações (design tokens)

### Cores — comuns

| Token CSS | Valor | Confiança |
|-----------|-------|-----------|
| `--color-bg-canvas` | `#FFFFFF` | confirmed |
| `--color-bg-surface` | `#F8FAFC` | confirmed |
| `--color-bg-muted` | `#F1F5F9` | confirmed |
| `--color-text-primary` | `#1F2937` | confirmed |
| `--color-text-secondary` | `#6B7280` | confirmed |
| `--color-border-subtle` | `#E5E7EB` | confirmed |
| `--color-border-default` | `#D1D5DB` | confirmed |
| `--color-feedback-success` | `#16A34A` | confirmed |
| `--color-feedback-warning` | `#D97706` | confirmed |
| `--color-feedback-danger` | `#DC2626` | confirmed |

### Cores — `servicePortal` (SIGMA logado)

| Token CSS | Valor | Confiança |
|-----------|-------|-----------|
| `--color-brand-primary` | `#0066CC` | confirmed |
| `--color-brand-primary-hover` | `#005BB5` | confirmed |
| `--color-brand-primary-active` | `#004C99` | confirmed |
| `--color-brand-primary-subtle` | `#EAF2FF` | confirmed |
| `--color-link` / `--color-focus` | `#0066CC` | confirmed |

Aliases adicionais no layout shell (`.iptu-app-shell`):

| Token | Valor |
|-------|--------|
| `--franca-brand` | `#0066CC` |
| `--franca-brand-hover` | `#005BB5` |
| `--franca-brand-subtle` | `#EAF2FF` |
| `--franca-canvas` | `#FFFFFF` |
| `--franca-surface` | `#F8FAFC` |
| `--franca-border` | `#E5E7EB` |
| `--franca-text` | `#1F2937` |
| `--franca-text-muted` | `#6B7280` |

### Cores — `legacyPortal`

| Token | Valor |
|-------|--------|
| `--color-brand-primary` | `#0199DC` |
| `--color-brand-primary-hover` | `#0188C4` |
| `--color-brand-primary-active` | `#0177AB` |
| `--color-brand-primary-subtle` | `#E6F6FC` |

### Cores — login (`LoginScreen`)

| Uso | Classes Tailwind | Confiança |
|-----|------------------|-----------|
| Fundo página | `bg-slate-100` | confirmed |
| Input borda | `border-sky-200/90`, focus `border-sky-500` | confirmed |
| Botão primário | `from-sky-600 to-blue-600` | confirmed |
| Links | `text-sky-700` | confirmed |
| Brand Tailwind extend | `brand.DEFAULT` `#0066CC` em `tailwind.config.ts` | confirmed |

### Tipografia

| Elemento | Especificação | Confiança |
|----------|---------------|-----------|
| Família sans (app) | `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` | confirmed |
| Body | `16px` / `line-height: 1.6` | confirmed |
| `.ds-title` | `24px`, weight `700`, line-height `1.3` | confirmed |
| `.ds-subtitle` | `14px`, cor secundária | confirmed |
| `.ds-label` | `14px`, weight `600` | confirmed |
| `.ds-help` | `12px`, cor secundária | confirmed |
| `.iptu-app-brand__kicker` | `11px`, uppercase, letter-spacing `0.04em` | confirmed |
| `.iptu-topbar__hello` | `14px` | confirmed |

### Espaçamento (escala usada)

| Token | Valor |
|-------|--------|
| `--space-2` | `8px` |
| `--space-3` | `12px` |
| `--space-4` | `16px` |
| `--space-6` | `24px` |
| Padding `.ds-app` | `24px 16px` (mobile: `12px`) | confirmed |
| Padding `.ds-panel` | `16px` | confirmed |
| Gap `.ds-grid` | `12px` | confirmed |

### Raio, sombra, motion

| Token | Valor |
|-------|--------|
| `--radius-md` | `8px` |
| `--radius-lg` | `12px` |
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.1)` |
| `--shadow-md` | `0 4px 8px rgba(0,0,0,0.1)` |
| Transição botões | `180ms ease` | confirmed |
| Modal overlay | `rgba(0,0,0,0.45)`, `z-index: 500` | confirmed |
| Dropdown perfil | `z-index: 400` | confirmed |

### Breakpoints (CSS)

| Breakpoint | Comportamento |
|------------|----------------|
| `max-width: 1100px` | Shell 3 colunas → empilhado; `sigma-two-col` → 1 coluna |
| `max-width: 1024px` | `.ds-grid` → 2 colunas |
| `max-width: 640px` | `.ds-grid` → 1 coluna; toolbar em grid 2 colunas |

### Layout containers

| Elemento | Largura / estrutura |
|----------|---------------------|
| `.ds-app` | `max-width: 1200px`, centralizado |
| `.iptu-app-shell` | Grid `236px` sidebar + miolo flex (`100vw` max) |
| `.sigma-two-col` | Form `1fr` + prévia/resumo `260–320px` |

---

## Arquitetura de telas

### Mapa de rotas

| Rota | Componente | Descrição |
|------|--------------|-----------|
| `/` | `LoginScreen` | Autenticação JWT |
| `/cco` | `CcoApp` | Central de Controle Operacional pós-login |
| `/mobile` | `CampoPwaApp` | PWA mobile para execução de vistorias em campo |
| `/login` | redirect → `/` | Compatibilidade |

### Layout `/cco`

```
prefeitura-shell
├── prefeitura-topo (img topo-sistemas.png) — oculto no shell iptu
├── prefeitura-content
│   └── iptu-app-shell [data-theme=servicePortal]
│       ├── iptu-app-nav (sidebar)
│       ├── iptu-app-stage
│       │   ├── PortalAppTopbar (iptu-topbar)
│       │   ├── iptu-app-miolo-scroll (ds-app)
│       │   └── PortalAppFooter (iptu-footer-line)
└── prefeitura-footer — oculto no shell iptu
```

### Navegação principal (`NavTab`)

| Tab | Painel | Visibilidade |
|-----|--------|----------------|
| `mapa` | `MapaOperacionalPanel` | Todos autenticados |
| `ativos` | `PropriosPublicosPanel` | Gestores e Admin |
| `checklists` | `ChecklistsPanel` | Gestores e Admin |
| `vistorias` | `VistoriasPanel` | Todos autenticados conforme perfil |
| `chamados` | `ChamadosPanel` | Todos autenticados conforme perfil |
| `relatorios` | `RelatoriosPanel` | Gestores e Admin |
| `administrador` | `AdministradorPanel` | Admin |
| `logs` | `LogsPanel` | Admin |

---

## Componentes (especificação)

### Botão — `.ds-btn`

| Propriedade | Valor |
|-------------|--------|
| `min-height` | `40px` |
| `min-width` | `118px` (toolbar: flexível) |
| `border-radius` | `8px` |
| `font-size` | `14px` |
| `font-weight` | `600` |
| Borda | `1px solid var(--color-brand-primary)` |
| Fundo default | `#fff` |
| Cor texto | `var(--color-brand-primary)` |
| Hover | texto branco, `translateY(-1px)` | inferred |
| Focus | `outline 2px` + ring `3px` subtle |
| Disabled | `opacity: 0.5` |

**Variantes outline Bootstrap-like:** `.outline-primary`, `.outline-success`, etc. — borda `#0d6efd` (confirmed).

**Com ícone:** `.ds-btn-with-icon` + `.ds-btn-ico` (gap `8px`).

**Ação em linha de tabela:** `.ds-btn-row-action` — `min-height: 28px`, `font-size: 12px`.

### Abas — `.ds-tab` / `.ds-tabs`

| Estado | Estilo |
|--------|--------|
| Default | borda default, fundo branco |
| Active | fundo `brand-primary-subtle`, borda brand, texto brand, weight 600 |
| Nested | `.ds-tabs--nested` — `margin-top: 20px` |

### Painel — `.ds-panel`

- Fundo canvas, borda subtle, `border-radius: 12px`, `shadow-sm`, padding `16px`, `margin-top: 12px`.

### Campo de formulário

| Classe | Uso |
|--------|-----|
| `.ds-field` | Wrapper coluna, gap `8px` |
| `.ds-field.grow` | `grid-column: span 2` |
| `.ds-label` | Rótulo obrigatório visível |
| `.ds-input` / `.ds-textarea` | `min-height: 44px` (textarea `120px`) |
| `.ds-help` | Texto auxiliar |
| `.ds-check` | Radio/checkbox inline, `accent-color: #2b507c` |

### Grade de formulário — `.ds-grid`

- Desktop: **4 colunas**; tablet 2; mobile 1.

### Tabela — `.ds-table`

| Parte | Estilo |
|-------|--------|
| Wrapper | `.ds-table-wrap` — `overflow-x: auto`, borda, radius `12px` |
| Header | fundo muted, padding `16px`, weight 600 |
| Zebra | `#FCFCFD` em linhas pares (exceto `.selected`) |
| Selecionada | fundo `brand-primary-subtle` |
| Linha clicável | `.ds-table--select-row` |
| Bloqueada | `.is-bloqueada-divida` — texto secundário, fundo `#f5f5f7` |

### Badge — `.ds-badge`

| Variante | Fundo / texto |
|----------|----------------|
| `.ok` | `#EAF8F0` / success |
| `.warn` | `#FFF5E8` / warning |
| `.sigma-badge-concluido` | `#E8F4FC` / `#0D6EFD` |
| `.sigma-badge-critico` | `#FDE8E8` / `#B42318` |

### Banner de modo visualização — `.ds-view-banner`

- Fundo `#FFF8E1`, borda `#F0C44D`, texto `#6A5400`, weight 600.

### Paginação — `.ds-pagination`

- Meta `13px`, status em `#2B507C`, ações alinhadas à direita, select compacto.

### Shell lateral — `.iptu-app-nav`

| Elemento | Especificação |
|----------|----------------|
| Largura | `minmax(200px, 236px)` |
| Item nav | `.iptu-nav-btn` — padding `10px 12px`, radius `8px` |
| Active | fundo brand-subtle, borda brand 35% opacity |
| Toolbar SIGMA | `.sigma-nav-toolbar` — botões coluna, largura 100% |

### Topbar — `.iptu-topbar`

- Saudação, chip de perfil com avatar gradiente brand, dropdown perfil (min-width `320px`), ação sair.

### Formulários SIGMA — layout duas colunas

```text
.sigma-two-col
├── Coluna 1: formulário (ds-panel, ds-grid)
└── Coluna 2: resumo contextual (.sigma-preview-head gradiente brand)
```

### Cards de checklist — `.sigma-checklist-card`

- Card clicável com checkbox visual `.sigma-checklist-check`.
- Estado on: borda e fundo brand-subtle; check preenchido brand.

### Relatórios — `.sigma-stat-grid` / `.sigma-stat-card`

| Variante | Cor do valor |
|----------|----------------|
| `--primary` | brand `#0066CC` |
| `--success` | `#198754` |
| `--info` | `#0D6EFD` |
| `--danger` | `#DC3545` |
| `--muted` | text secondary |

Filtros: `.sigma-relatorios-filtros` — grid auto-fill `minmax(160px, 1fr)`.

### Modal — `.sigma-modal-overlay` / `.sigma-modal`

- Overlay fullscreen, modal `max-width: 480px`, `max-height: 80vh`, scroll interno.

### Login — componentes Tailwind

| Elemento | Classes principais |
|----------|-------------------|
| Input | `rounded-xl border-sky-200/90 bg-slate-50 pl-11 focus:ring-sky-400/35` |
| Botão primário | `rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 uppercase` |
| Link | `text-sky-700 hover:underline` |
| Animação step | `.animate-login-step` — fade + translateY `6px` |

---

## Impressão

| Arquivo | Função |
|---------|--------|
| `print-vistoria.css` | Estilos de vistoria e ordem de serviço |
| `globals.css` `@media print` | Oculta UI, exibe `#printArea` A4 |
| Classe `.no-print` | Elementos ocultos na impressão |

---

## Acessibilidade

| Regra | Implementação SIGMA |
|-------|---------------------|
| Alvo de toque mínimo | Inputs `44px`; botões `40px` | confirmed |
| Focus visível | `focus-visible` em botões, tabs, inputs | confirmed |
| Labels | `.ds-label` em campos; ícones SVG com `aria-hidden` no login | confirmed |
| Teclado dropdown | Fecha ao clicar fora (`PortalAppTopbar`) | confirmed |
| Mensagens de erro | Texto em `.ds-help` / estado erro (não só cor) | inferred |
| Idioma | `<html lang="pt-BR">` | confirmed |

**Recomendações (inferred):**

- Não usar `maximum-scale=1` no viewport.
- Tabelas sempre dentro de `.ds-table-wrap` no mobile.
- Modais: foco preso e fechar com `Esc` (implementar se ausente).

---

## Regras de implementação

### Obrigatório

1. **App logado:** usar classes `ds-*`, `iptu-*`, `sigma-*`, Tailwind utilitário quando adequado e `data-theme="servicePortal"`.
2. **Não hardcodar** `#0066CC` / `#0199DC` em novos componentes — preferir `var(--color-brand-primary)` ou `var(--franca-brand)`.
3. **Login:** usar Tailwind e manter estilo visual consistente com a identidade municipal.
4. **Estados interativos:** hover, focus-visible, active, disabled em controles novos.
5. **Formulários:** todo input com `.ds-label` visível; placeholder não substitui label.
6. **Admin:** telas de usuários, permissões, parâmetros e logs só quando `me.isAdmin === true`.

### Estrutura de arquivos

```text
frontend/
├── app/
│   ├── globals.css          # Tailwind + estilos globais
│   ├── portal-ds.css        # Design system principal
│   ├── page.tsx             # Login
│   ├── cco/                 # Central de Controle Operacional
│   └── mobile/              # PWA de campo
├── components/
│   ├── CcoApp.tsx
│   ├── CampoPwaApp.tsx
│   ├── LoginScreen.tsx
│   ├── MapaOperacionalPanel.tsx
│   ├── PropriosPublicosPanel.tsx
│   ├── ChecklistsPanel.tsx
│   ├── VistoriasPanel.tsx
│   ├── ChamadosPanel.tsx
│   ├── RelatoriosPanel.tsx
│   ├── AdministradorPanel.tsx
│   ├── LogsPanel.tsx
│   └── portal/
└── lib/                     # API, tipos, autenticação, PWA/offline
```

### API / proxy

- Dev: proxy `/api-sigma` → backend NestJS.
- Produção Docker: `NEXT_PUBLIC_API_PROXY=true`, `BACKEND_INTERNAL_URL=http://backend:3001`.
- Portas padrão: frontend **3000**, API **3001**.

---

## Guia para Cursor / LLM

Ao gerar UI para o SIGMA:

1. Reutilizar classes existentes antes de criar CSS novo.
2. Respeitar `data-theme="servicePortal"` no app logado.
3. Formulários: `.ds-grid` + `.ds-field` + `.ds-label` + `.ds-input`.
4. Listagens: `.ds-table-wrap` > `.ds-table`.
5. Ações primárias: `.ds-btn` (não inventar botão sem borda brand).
6. Cards de métricas: `.sigma-stat-card` com modificador `--primary|--success|...`.
7. Não alterar o layout `iptu-app-shell` sem revisar breakpoints `1100px` e `640px`.
8. Login permanece visualmente distinto (gradiente sky/blue) — não forçar `ds-btn` na tela de entrada.

### Checklist de PR visual

- [ ] Tokens CSS usados em vez de cores soltas
- [ ] Responsivo testado em ≤640px e ≤1100px
- [ ] Focus visível nos controles novos
- [ ] Tabela com wrapper scroll no mobile
- [ ] Textos de erro acessíveis (não só cor vermelha)

---

## Referências

| Recurso | Caminho |
|---------|---------|
| Tokens e componentes CSS | `frontend/app/portal-ds.css` |
| Tailwind brand | `frontend/tailwind.config.ts` |
| App principal | `frontend/components/CcoApp.tsx` |
| Login | `frontend/components/LoginScreen.tsx` |
| Design system municipal (origem) | `franca-design-system` (Prefeitura de Franca) |
| Manual do usuário | `docs/manual-do-usuario.html` |

---

*Documento base para o SIGMA. Atualize este arquivo quando alterar tokens em `portal-ds.css`, Tailwind ou a estrutura de layout.*
