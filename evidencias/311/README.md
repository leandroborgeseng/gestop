# Evidências #311 (ciclo 2)

Prints ZZTESTE **não gerados aqui**: não há Postgres/API local nem sessão HEF neste worktree (`DATABASE_URL` ausente; sem seed).

## O que o Tester / Programador com desktop deve capturar (só ZZTESTE)

| ID | Cenário | Arquivo sugerido |
|----|---------|------------------|
| CCO-V4 | Miniatura → lightbox com `Foto n de total` + Anterior/Próxima; Esc volta ao modal | `v4-lightbox-nav.png` |
| CCO-V4 | Anexo PDF/não-imagem com **Abrir anexo** e **Baixar** (não abre no viewer de imagem) | `v4-anexo-nao-imagem.png` |
| CCO-V10 | Antes/depois de fechar o modal (próprio, aba Vistorias, filtros, zoom) | `v10-antes.png` / `v10-depois.png` |
| CCO-V11 | Mapa em tela cheia + modal visível por cima (portal no shell) | `v11-fullscreen-modal.png` |
| CCO-V12 | Modal em 1280×800, 800×1280 e 375 | `v12-1280.png` `v12-800x1280.png` `v12-375.png` |
| B1 | Erro da lista: `Não foi possível carregar as vistorias. Tentar de novo` | `b1-erro-lista.png` |

Ambiente: HEF ou `docker compose` + `npm run prisma:seed` com usuário de teste e próprio **ZZTESTE**.
