# Evidências #311 — prints ZZTESTE

Gerados localmente (America/Sao_Paulo) contra `factory/311-cco-modal-vistoria`.  
Ambiente: Postgres embutido `:55551`, API `:3011`, frontend `:3010`.  
Scripts: `scripts/seed-zzteste-311.ts`, `scripts/shots-311.mjs`, `scripts/shots-311-v11-v12.mjs`.

| Arquivo | Critério | Nota |
|---------|----------|------|
| `v4-lightbox-nav.png` / `v4-lightbox-foto2.png` | CCO-V4 | Foto n de total + Anterior/Próxima |
| `v4-anexo-nao-imagem.png` | CCO-V4 | Abrir anexo / Baixar |
| `v10-antes.png` / `v10-depois.png` | CCO-V10 | Contexto CCO ao fechar modal |
| `v11-fullscreen-modal.png` | CCO-V11 | Mapa em tela cheia + modal por cima |
| `v12-1280.png` / `v12-800x1280.png` / `v12-375.png` | CCO-V12 | Viewports; 375 com footer acima do bottom nav |
| `b1-erro-lista.png` | B1 UX | `… Tentar de novo` |

## V11 — fullscreen no headless

`requestFullscreen()` é bloqueado no Chrome headless. O shot força a classe **`.sigma-map-shell.sigma-map-fullscreen`** (mesmo host do fallback CSS da app) e esconde chrome/sidebar (`nav` principal, nav mobile, header sticky) via `data-shot-fullscreen`, para o mapa ocupar a viewport. O drawer da unidade é ocultado no momento do print para não competir com o modal; o modal de consulta permanece visível por cima do mapa.

## V12-375 / U311-8

O modal usa `pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))]` no overlay e `max-h` descontando `--bottom-nav-h` (5.75rem), para **Fechar** e **Abrir em Vistorias realizadas** ficarem acima do menu inferior. Assert no script: `navTop - footerBottom >= 0` (clearance medido ≈ 8px no shot regenerado).
