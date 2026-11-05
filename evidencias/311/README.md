# Evidências #311 (ciclo 2) — prints ZZTESTE

Gerados localmente em 05/11/2026 (America/Sao_Paulo) contra worktree `factory/311-cco-modal-vistoria`, API `:3011` + frontend `:3010`, Postgres embutido (`pgserver` em `:55551`), seed + fixture `scripts/seed-zzteste-311.ts`. Login demo `admin.gestop@franca.sp.gov.br` (só teste). Script: `scripts/shots-311.mjs`.

| Arquivo | Critério |
|---------|----------|
| `v4-lightbox-nav.png` | CCO-V4 — lightbox com **Foto 1 de 2** + Anterior/Próxima |
| `v4-lightbox-foto2.png` | CCO-V4 — após Próxima |
| `v4-anexo-nao-imagem.png` | CCO-V4 — anexo PDF com **Abrir anexo** / **Baixar** |
| `v10-antes.png` / `v10-depois.png` | CCO-V10 — drawer Vistorias antes/depois de fechar o modal |
| `v11-fullscreen-modal.png` | CCO-V11 — modal sobre mapa em modo fullscreen (fallback CSS no shell) |
| `v12-1280.png` | CCO-V12 — 1280×800 |
| `v12-800x1280.png` | CCO-V12 — 800×1280 |
| `v12-375.png` | CCO-V12 — 375×812 |
| `b1-erro-lista.png` | B1 — `Não foi possível carregar as vistorias. Tentar de novo` |

Observação: fullscreen nativo (`requestFullscreen`) é bloqueado no Chrome headless; a evidência V11 usa a classe `.sigma-map-fullscreen` (mesmo host de portal do fallback).
