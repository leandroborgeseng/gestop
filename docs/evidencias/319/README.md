# 319 · CCO, Mapa: Notas — filtro de categorias

Ambiente local `_test` (`gestop_310_test`), dados sintéticos ZZTESTE/@aion.local (`seed319`), criados em 04/11/2026 à noite (BRT):

| Próprio | Vistoria | Respostas |
|---|---|---|
| ZZTESTE Escola Alfa 1 (ZZTA) | concluída | Água BOM, Elétrica ÓTIMO |
| ZZTESTE Praça Alfa (ZZTA) | concluída | Água RUIM, Elétrica com resposta inválida |
| ZZTESTE Área de lazer Alfa (ZZTA) | **cancelada** | Telhado BOM |
| ZZTESTE UBS Beta (ZZTB) | concluída | Pintura REGULAR |

Também existe "ZZTESTE Jardinagem (sem avaliação)", que está no catálogo e não tem nenhuma resposta. Medições em `log.json`.

**Antes (main):** a lista mostrava o catálogo inteiro de categorias ativas (`opcoes-filtro.categoriasVistoria`), mesmo sem nenhuma avaliação.

| Critério | Evidência |
|---|---|
| "Nota geral (Likert)" primeiro | `log.json` → `ui.opcoes[0]`; `desktop-1` |
| Só categorias com avaliação válida nas vistorias dos próprios filtrados | Telhado (só em vistoria **cancelada**) e Jardinagem (sem resposta) nunca aparecem. Elétrica conta 1, porque a resposta inválida da Praça não conta |
| Exclui vistorias canceladas/não concluídas | mesma fonte do mapa: a última vistoria **CONCLUÍDA** de cada próprio (`loadUltimasNotasPorUnidade`); teste de banco com cancelada, em andamento e concluída antiga |
| Ordem alfabética | `Intl.Collator('pt-BR')` sem diferenciar acento/caixa ("Água", "banheiro", "Pintura" no teste de banco) |
| Backend, todo o conjunto | `GET /operacional/categorias-nota-disponiveis` (mesmos filtros de `/unidades`, todos os próprios filtrados); 14–20 ms localmente |
| Voltar para Nota geral se a categoria sumir | `desktop-2`: com "Pintura" selecionada, filtrar Secretaria ZZTA tira a Pintura → valor volta para "Nota geral (Likert)" (`voltouParaNotaGeral: true`) |
| Sem nota → "Sem avaliação", nunca zero | popup "Nota: Sem avaliação", marcador cinza "—" com `title`/`aria-label` "Sem avaliação", legenda "Sem avaliação" (`desktop-3`); nota 0 real continua "0,0" |
| Escopo de Secretaria | gestor ZZTA não vê Pintura (ZZTB); admin "Todas" vê. Teste de banco: pedido forçado de outra Secretaria → vazio; sem Secretaria → vazio |
