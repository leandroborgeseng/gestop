# Prompt para o Cursor — Implementação do redesign SIGMA

> Copie tudo abaixo (a partir da linha `---`) e cole no Cursor, anexando os arquivos: `HANDOFF.md`, `app/styles.css` e os `.html` de referência (principalmente `SIGMA - CCO.html` e `SIGMA - Campo Mobile.html`).

---

Você é um engenheiro frontend sênior. Vou implementar um **redesign de UI completo** no projeto Next.js existente em `frontend/`. Anexei: `HANDOFF.md` (especificação completa), `app/styles.css` (fonte dos design tokens) e protótipos `.html` interativos (referência visual de comportamento, hover, estados e transições).

## Stack e restrições (NÃO violar)
- Next.js 16 · React 19 · Tailwind CSS 4 · Lucide icons · Leaflet. pt-BR. **Light mode apenas**.
- **NÃO altere** contratos de API (`lib/api.ts` e `/api-gestop/*`), as rotas/URLs existentes, nem o RBAC (`RequirePermissions`, menu filtrado por permissão). A mudança é **somente de UI/estilo**.
- Preserve a lógica de negócio das páginas; refatore apenas apresentação.
- Acessibilidade WCAG 2.1 AA: foco visível, contraste, alvos de toque ≥44px no mobile.

## Objetivo
Elevar a interface atual (Material genérico) para nível **gov-tech profissional / command center**, mantendo a identidade da Prefeitura de Franca (azul `#0066CC`). Siga o `HANDOFF.md` como fonte de verdade; os `.html` mostram o resultado visual esperado.

## Sistema de design (resumo — detalhes no HANDOFF)
- **Tokens:** cole o bloco `:root` da seção 2 do HANDOFF em `app/globals.css` e crie o `@theme inline` do Tailwind. Neutros em slate frio; semânticas ok/warn/danger; raios 8–14px; 3 sombras.
- **Tipografia:** trocar **Inter → IBM Plex Sans** (UI) + **IBM Plex Mono** (códigos, IDs, KPIs, prazos, coordenadas). Ajustar `app/layout.tsx`. Números sempre em mono com `tnum`.
- **Componentes:** evoluir `components/ui/*` conforme seção 5 (Button, Badge, Chip, StatusBadge, Input/Select/Field com foco `brand-soft`, MetricCard clicável, Tabs sublinhado, Drawer/Sheet, Toast, FAB).

## Ordem de implementação (siga exatamente)
1. **Tokens + fonte** → `globals.css`, `layout.tsx`.
2. **Componentes base** → `components/ui/*`.
3. **AppShell** → `components/layout/app-shell.tsx` (sidebar 264px colapsável, nav agrupada Operação/Gestão/Configuração, item ativo com barra brand; topbar com busca `/`, pílulas Online + Sync, botão Guia `?`) e `page-shell.tsx` (kicker+título+descrição+ações). Mobile: app bar + bottom nav (4 + “Mais” em sheet).
4. **Login** (`app/login`) → split layout (painel marca gradiente + card form); estados loading/erro/sessão expirada/força de senha.
5. **CCO** (`app/(authenticated)/cco`) — PRIORITÁRIA:
   - 4 KPIs clicáveis (viram filtro), mapa Leaflet + painel de filtros + lista.
   - **Mapa e lista sincronizados**: filtro/busca/seleção em um reflete no outro; hover na lista destaca o pin; clique abre drawer/página da unidade.
   - **Toggle Mapa/Satélite** em `components/operational-map.tsx` (tiles na seção 7 do HANDOFF: CARTO Voyager para mapa; Esri World Imagery + overlay `voyager_only_labels` para satélite).
6. **Demais telas** seguindo seção 6: detalhe da unidade, Campo PWA (offline-first: check-in GPS, checklist toques grandes, “Não conf.” revela nota+foto, fila de sync com FAB, estado de conexão), Chamados (triagem com ações + toast), Ordens de serviço (timeline + ações que avançam status), Dashboard, Admin (abas CRUD + LGPD), Checklists (versionado), Relatórios, Integrações, Conta, Chamado QR público.
7. **Manual em tempo real** (transversal — pedido central do cliente): criar `components/help/guide-panel.tsx` + `lib/guide-content.ts` (conteúdo por rota: “Nesta tela”, “Como fazer” em passos, “Glossário”). Abrir via botão Guia e tecla `?`. Incluir TipBanner dispensável (persistir em localStorage) e tooltips “?”. Conteúdo de referência em `app/guide.jsx` do pacote.

## Entregas esperadas
- Commits incrementais por etapa (tokens → shell → login → CCO → …).
- Reaproveitar componentes existentes (não recriar do zero).
- Ao final, listar os arquivos alterados e quaisquer pontos onde a API atual não expõe um dado que a UI nova pede (para eu decidir).

Comece pela **etapa 1 (tokens + fonte)** e me mostre o diff de `globals.css` e `layout.tsx` antes de seguir.
