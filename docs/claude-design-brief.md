# GestOP — Brief completo para redesign de UI (Claude Design)

> **Como usar:** copie a seção **PROMPT PARA CLAUDE DESIGN** (final deste arquivo) e anexe este documento ou trechos relevantes. Depois, devolva os entregáveis ao Cursor para implementação no código Next.js existente.

---

## 1. Contexto do produto

| Item | Descrição |
|------|-----------|
| **Nome** | GestOP — Gestão de Ordens de Serviço e Fiscalização Georreferenciada |
| **Cliente** | Prefeitura Municipal de Franca (SP) |
| **Tipo** | Plataforma web + PWA para gestão operacional de patrimônio público |
| **Produção** | https://gestop.up.railway.app |
| **Stack UI** | Next.js 16 · React 19 · Tailwind CSS 4 · TypeScript · Lucide icons |
| **Mapas** | Leaflet + MarkerCluster (não substituir por outra lib sem aviso) |
| **Idioma** | pt-BR exclusivo |

### Problema que resolve

Gestores da CCO (Central de Controle Operacional) monitoram **próprios públicos** (escolas, UBS, praças, prédios) no mapa, acompanham fiscalizações, não conformidades e ordens de serviço. Agentes de campo executam **checklists georreferenciados** offline/online. Cidadãos abrem **chamados via QR Code** em unidades.

### Objetivo deste redesign

Elevar a interface de "funcional / Material Design genérico" para **nível profissional de produto gov-tech / enterprise**, mantendo identidade institucional da Prefeitura de Franca, alta legibilidade, confiança e eficiência operacional (desktop + mobile/PWA).

---

## 2. Personas e perfis

| Perfil | Uso principal | Telas |
|--------|---------------|-------|
| **Administrador** | Cadastros, usuários, LGPD | Admin, Checklists, Integrações, Dashboard |
| **Gestor CCO** | Mapa, triagem, relatórios | CCO, Chamados, OS, Dashboard, Relatórios |
| **Agente de Campo** | Fiscalização mobile offline | Mobile (PWA), CCO (consulta) |
| **Operador Manutenção** | Chamados e OS | Chamados, Ordens de Serviço |
| **Cidadão (público)** | Abrir chamado via QR | `/chamado/[codigo]` (sem login) |

Permissões RBAC controlam visibilidade do menu — **não redesenhar fluxo de auth**, só UI.

---

## 3. Mapa completo de telas (19 rotas)

### Públicas (sem autenticação)

| Rota | Nome | Conteúdo / blocos |
|------|------|-------------------|
| `/` | Redirect | Redireciona para login ou CCO |
| `/login` | Login | Split layout: painel brand (desktop) + card formulário; e-mail, senha, link recuperar senha; estados: loading, erro, sessão expirada |
| `/recuperar-senha` | Recuperar senha | Form e-mail, feedback genérico |
| `/redefinir-senha` | Redefinir senha | Token na URL, nova senha + confirmação |
| `/chamado/[codigo]` | Chamado público (QR) | Logo PMF, dados da unidade, form chamado (descrição, contato), confirmação pós-envio |

### Autenticadas (shell com sidebar desktop + bottom nav mobile)

| Rota | Nome | Conteúdo / blocos |
|------|------|-------------------|
| `/cco` | **CCO — Home operacional** | 4 metric cards, mapa Leaflet fullscreen em card, filtros (secretaria, bairro, tipo, situação, busca), listagem de unidades sincronizada com mapa |
| `/cco/unidades/[id]` | Detalhe da unidade | Header unidade, mapa mini, tabs/listas: fiscalizações, NCs, OS, metadados patrimoniais |
| `/mobile` | **PWA Campo** | Seleção unidade + checklist, cards de itens (sim/não/texto/foto), GPS check-in, fila offline, FAB sync, banner instalar PWA |
| `/chamados` | Triagem chamados | Filtros por status (chips), cards/lista com ações: triagem, encaminhar OS, cancelar |
| `/ordens-servico` | Lista OS | Filtros status/prioridade, cards com código, prazo, responsável |
| `/ordens-servico/[id]` | Detalhe OS | Timeline status, origem (NC/chamado), ações atualizar |
| `/dashboard` | Dashboard | Metric cards, alertas operacionais, push notifications panel, auditoria recente, links rápidos |
| `/relatorios` | Relatórios | Export CSV/PDF por tipo (unidades, fiscalizações, OS, chamados), filtros período |
| `/admin` | Administração | Tabs: Secretarias, Unidades, Usuários — form + list CRUD, LGPD (anonimizar, purge auditoria) |
| `/checklists` | Checklists | Lista modelos, criar, versões |
| `/checklists/[id]` | Editor checklist | Itens, tipos, ordem, publicar versão |
| `/integracoes` | Integrações | Eventos webhook, retry sync, status técnico |
| `/conta` | Minha conta | Alterar senha |

---

## 4. Layout e navegação atual

### Desktop (≥1024px)

```
┌─────────────────────────────────────────────────────────┐
│ SIDEBAR 280px          │ MAIN CONTENT                    │
│ ┌────────────────────┐ │ PageShell: kicker + title +     │
│ │ Logo PMF + GestOP  │ │ description + action            │
│ │ Nome + perfis      │ │                                 │
│ ├────────────────────┤ │ [conteúdo da página]            │
│ │ Nav links          │ │                                 │
│ │ · CCO              │ │                                 │
│ │ · Campo            │ │                                 │
│ │ · Chamados         │ │                                 │
│ │ · ...              │ │                                 │
│ ├────────────────────┤ │                                 │
│ │ Minha conta        │ │                                 │
│ │ Sair               │ │                                 │
│ └────────────────────┘ │                                 │
└─────────────────────────────────────────────────────────┘
```

### Mobile (<1024px)

```
┌──────────────────────────┐
│ AppBar: logo + GestOP +   │
│ usuário + badge Online    │
├──────────────────────────┤
│                          │
│   Conteúdo (scroll)      │
│                          │
├──────────────────────────┤
│ Bottom nav: 4 slots +    │
│ "Mais" (sheet secundário)│
└──────────────────────────┘
```

**Itens de navegação** (filtrados por permissão):

- CCO, Campo, Chamados, Ordens de serviço, Dashboard, Relatórios, Administração, Checklists, Integrações

---

## 5. Design system atual (implementação real)

> ⚠️ O arquivo `designSystem.md` na raiz está **parcialmente desatualizado** (referencia componentes antigos `CcoApp`, `portal-ds.css`). A implementação real está em `frontend/app/globals.css` + componentes em `frontend/components/ui/`.

### Marca / cores

| Token | Valor | Uso |
|-------|-------|-----|
| Brand primary | `#0066CC` | Botões, links, nav ativo |
| Brand primary hover | `#005BB5` | Hover |
| Brand accent | `#0199DC` | Chips, badges secundários |
| Brand gradient | `#0066CC → #0199DC` | Painel login desktop |
| Surface / canvas | `#FFFFFF`, `#F8FAFC` | Fundos |
| Text primary | `#1F2937` | Títulos |
| Text secondary | `#6B7280` | Descrições |
| Success | `#16A34A` | Operacional OK |
| Warning | `#D97706` | Pendências |
| Danger | `#DC2626` | Crítico, erros |

### Tipografia

- **Fonte:** Inter (Google Fonts), fallback system-ui
- **Escala MD3:** display-sm, headline-lg/md, title-lg/md, body-lg/md, label-lg/md (CSS vars em `globals.css`)

### Forma (border-radius)

- Pills/full: `9999px` (botões, nav)
- Cards: `0.75rem–1rem`
- Inputs: arredondados consistentes com MD3

### Elevação

- 5 níveis de shadow MD3 (`--md-elevation-1` a `-5`)

### Componentes UI existentes (manter API/nomes se possível)

```
components/ui/
  alert.tsx          — success | warning | error | info
  badge.tsx          — status semânticos
  button.tsx         — filled | tonal | outlined | text | ghost | danger (com ripple MD)
  card.tsx           — CardHeader, CardTitle, CardDescription, CardContent
  chip.tsx           — brand | accent | neutral
  fab.tsx            — floating action (mobile sync)
  field.tsx          — label + help + error wrapper
  form-section.tsx   — FormGrid, FormSection, RecordList
  input.tsx, select.tsx
  list-item.tsx
  sheet.tsx          — drawer mobile "Mais"
  skeleton.tsx       — loading shimmer
  snackbar.tsx       — toasts globais
  surface.tsx        — elevated surfaces
  table.tsx
  tabs.tsx
```

**Componentes de domínio:**

- `metric-card.tsx` — KPIs com ícone
- `status-badge.tsx` — situação unidade, status OS/chamado
- `operational-map.tsx` — mapa Leaflet
- `unidade-filters.tsx`, `unidade-list.tsx`
- `checklist-item-card.tsx` — mobile field
- `page-shell.tsx` — header padrão de página
- `app-shell.tsx` — sidebar + mobile chrome

### Logo

- Imagem institucional: `prefeitura-franca-logo.png` (PMF)
- Product label textual: **GestOP** + subtítulo "Central Operacional"
- Variantes: full, compact, mark; tema light para fundos escuros

---

## 6. Estados de interface (obrigatórios em cada tela)

- **Loading:** skeleton ou spinner com label ("Carregando indicadores...")
- **Empty:** ilustração/texto quando listas vazias
- **Error:** banner/card vermelho com mensagem acionável
- **Success:** feedback após ações (snackbar ou alert verde)
- **Disabled / busy:** botões com opacity durante submit

---

## 7. Restrições técnicas para implementação

1. **Não alterar contratos de API** — frontend consome `/api-gestop/*` via proxy Next.js
2. **Manter rotas** — mesmos paths URL listados acima
3. **Manter RBAC** — `RequirePermissions`, menu filtrado por permissão
4. **Tailwind CSS 4** — preferir tokens CSS em `:root` / `@theme inline`
5. **Acessibilidade:** WCAG 2.1 AA, focus visible, contraste gov, touch targets ≥44px mobile
6. **Responsivo:** mobile-first; CCO mapa deve funcionar em telas pequenas
7. **PWA:** `/mobile` instalável, offline queue — UI deve comunicar status sync
8. **Performance:** evitar animações pesadas; Leaflet já é pesado no mapa
9. **framer-motion** já está no projeto — pode usar com moderação

---

## 8. Referências visuais desejadas (direção criativa)

Buscar estética de:

- **Gov-tech premium:** Linear.app, Vercel Dashboard, Stripe Dashboard (clareza, densidade informacional)
- **Operações / command center:** mapas com overlay limpo, métricas em destaque, hierarquia clara
- **Institucional BR:** sobriedade, confiança, azul PMF — **não** parecer startup colorida demais
- **Mobile field:** apps de inspeção (SafetyCulture, Fulcrum) — botões grandes, progresso checklist

**Evitar:**

- Gradientes excessivos, glassmorphism genérico, dark mode (não implementado)
- Ícones emoji, ilustrações infantis
- Tabelas ilegíveis no mobile
- Sidebar estreita demais para labels longos em pt-BR

---

## 9. Entregáveis esperados do Claude Design

Devolva ao Cursor (para codificar) **nesta ordem**:

### A. Design tokens atualizados

- Paleta completa (light mode)
- Tipografia (família — pode sugerir alternativa a Inter se justificar)
- Espaçamento, radius, shadows
- Formato: CSS variables ou JSON de tokens

### B. Component library spec

Para cada componente: variantes, tamanhos, estados, anatomia (padding, height), exemplos visuais ou código React+Tailwind

Prioridade: Button, Input, Card, Badge/Chip, Table, Tabs, Nav (sidebar + bottom), MetricCard, Alert, Modal/Sheet

### C. Layout shell redesign

- Sidebar desktop (colapsável? busca global?)
- Topbar mobile
- Bottom navigation
- Page header pattern

### D. Mockups / wireframes de alta fidelidade (telas-chave)

**Obrigatórias (desktop + mobile onde aplicável):**

1. Login
2. CCO (mapa + métricas + filtros + lista) — **tela mais importante**
3. Detalhe unidade
4. Mobile campo (checklist)
5. Chamados (triagem)
6. Dashboard
7. Admin (tabs)
8. Chamado público QR

**Desejáveis:** OS detalhe, Relatórios, Checklists editor, Conta

### E. Notas de interação

- Hover/focus/transitions
- Como filtros do mapa interagem com lista
- Empty states copy (pt-BR)
- Hierarquia tipográfica por nível de página

### F. Checklist handoff

- Lista de arquivos a alterar no repo (`globals.css`, `components/ui/*`, `app-shell.tsx`, etc.)
- Breaking changes evitados

---

## 10. Inventário de arquivos frontend (para referência)

```
frontend/
├── app/
│   ├── globals.css                 # TOKENS + estilos globais
│   ├── layout.tsx                  # Root layout, Inter font
│   ├── login/page.tsx
│   ├── recuperar-senha/page.tsx
│   ├── redefinir-senha/page.tsx
│   ├── chamado/[codigo]/page.tsx   # Público QR
│   ├── (authenticated)/
│   │   ├── layout.tsx              # Auth gate + AppShell
│   │   ├── cco/page.tsx
│   │   ├── cco/unidades/[id]/page.tsx
│   │   ├── mobile/page.tsx
│   │   ├── chamados/page.tsx
│   │   ├── ordens-servico/page.tsx
│   │   ├── ordens-servico/[id]/page.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── relatorios/page.tsx
│   │   ├── admin/page.tsx
│   │   ├── checklists/page.tsx
│   │   ├── checklists/[id]/page.tsx
│   │   ├── integracoes/page.tsx
│   │   └── conta/page.tsx
│   └── api-gestop/[...path]/route.ts
├── components/
│   ├── layout/app-shell.tsx        # NAV PRINCIPAL
│   ├── layout/page-shell.tsx
│   ├── brand/logo.tsx
│   ├── ui/                         # Design system components
│   └── ...
├── lib/
│   ├── api.ts                      # Todas chamadas API
│   ├── navigation.ts               # Menu items
│   ├── types.ts                    # Tipos TypeScript domínio
│   └── brand.ts                    # Cores marca
└── public/
    ├── logo.svg, icon.svg
    └── prefeitura-franca-logo.png
```

---

## 11. Dados de exemplo (para popular mockups)

**Unidade:** EMEB Prof. Florestan Fernandes · PMF-ESC-001 · Escola · Centro  
**Secretaria:** SME — Secretaria Municipal de Educação  
**Situações:** OPERACIONAL | COM_PENDENCIAS | SEM_LOCALIZACAO | INATIVA  
**Métricas CCO:** 165 próprios, 142 ativos, 23 fiscalizações, 8 pendências, 2 sync pendentes  
**Chamado:** "Vazamento no banheiro do 2º andar" · status ABERTO  
**OS:** OS-2026-0042 · URGENTE · Prazo 3 dias  

---

# PROMPT PARA CLAUDE DESIGN

Copie tudo abaixo e cole no Claude Design:

---

```
Você é um product designer sênior especializado em gov-tech e dashboards operacionais.

## Projeto
Redesenhar completamente a interface do **GestOP** — plataforma web + PWA da Prefeitura Municipal de Franca (SP) para gestão georreferenciada de ordens de serviço, fiscalizações e chamados em próprios públicos (escolas, UBS, praças).

URL produção: https://gestop.up.railway.app
Stack: Next.js 16, React 19, Tailwind CSS 4, Lucide icons, Leaflet (mapas).

## Objetivo
Transformar a UI atual (funcional, Material Design genérico, azul #0066CC) em uma interface **extremamente profissional**, digna de um command center municipal — clara, confiável, eficiente, desktop + mobile/PWA.

## Identidade
- Cliente: Prefeitura de Franca — logo institucional PMF obrigatório
- Cor primária atual: #0066CC (pode refinar harmonizando com #0199DC)
- Tom: institucional sóbrio + modernidade gov-tech (referências: Linear, Stripe Dashboard, SafetyCulture mobile)
- Idioma: pt-BR
- Light mode apenas

## Telas a redesenhar (19 rotas)
Públicas: Login, Recuperar senha, Redefinir senha, Chamado via QR (/chamado/[codigo])
Autenticadas: CCO (mapa+KPIs+filtros+lista), Detalhe unidade, Mobile campo/PWA, Chamados, Ordens de serviço (+ detalhe), Dashboard, Relatórios, Admin (CRUD secretarias/unidades/usuários), Checklists (+ editor), Integrações, Minha conta

## Layout
- Desktop: sidebar fixa ~280px + área principal
- Mobile: app bar + bottom nav (4 itens + "Mais") + sheet
- Menu filtrado por permissões RBAC (CCO, Campo, Chamados, OS, Dashboard, Relatórios, Admin, Checklists, Integrações)

## Tela prioritária
**/cco** — Central de Controle Operacional: 4 KPI cards, mapa Leaflet interativo, painel filtros, listagem unidades sincronizada com mapa. Deve parecer um "centro de comando" profissional.

## Componentes existentes (evoluir, não reinventar do zero)
Button (filled/tonal/outlined/ghost/danger), Card, Input, Select, Field, Badge, Chip, Alert, Tabs, Table, Sheet, FAB, MetricCard, PageShell, AppShell, StatusBadge, Skeleton, Snackbar

## Restrições
- Manter mesmas rotas URL e fluxos funcionais
- Não alterar APIs backend
- Acessibilidade WCAG 2.1 AA, touch targets ≥44px mobile
- Mapa Leaflet deve permanecer integrado
- Entregar tokens CSS, specs de componentes, layouts shell, mockups alta fidelidade (desktop + mobile)

## Entregáveis
1. Design tokens (cores, tipo, spacing, radius, elevation) em CSS variables
2. Spec da component library (variantes + estados)
3. Redesign AppShell (sidebar + mobile nav)
4. Mockups alta fidelidade: Login, CCO, Detalhe unidade, Mobile campo, Chamados, Dashboard, Admin, Chamado público QR
5. Notas de interação e handoff listando arquivos a alterar no repo Next.js

## Contexto anexo
[COLE AQUI o conteúdo das seções 1–11 deste documento, ou anexe o arquivo docs/claude-design-brief.md completo]

Produza o redesign completo pronto para um desenvolvedor implementar em React/Next.js + Tailwind.
```

---

## 12. Quando voltar ao Cursor

Traga de volta:

1. Tokens CSS / JSON
2. Mockups (imagens ou descrição detalhada pixel-a-pixel)
3. Specs de componentes
4. Prioridade de implementação (sugestão: tokens → shell → login → CCO → demais)

O Cursor implementará em `frontend/` preservando lógica de negócio em `lib/api.ts` e páginas existentes.
