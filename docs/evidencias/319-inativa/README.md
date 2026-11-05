# 319 · follow-up — categoria inativa no fim da lista

Ambiente local `_test` (`gestop_319_test`, Postgres 127.0.0.1:55433), Node 20.20.2, dados sintéticos `ZZTESTE 319 <sufixo>` criados e removidos pelo próprio teste. 04/11/2026, noite (BRT).

## Regra
`GET /operacional/categorias-nota-disponiveis` devolve cada categoria com `ativa: boolean`:
1. Categorias **ativas** com nota válida, em ordem alfabética pt-BR (`Intl.Collator('pt-BR')`, sem diferenciar acento/caixa).
2. Depois as **inativas** que têm nota válida, também em ordem alfabética pt-BR entre si.

No seletor "Categoria da nota" da CCO, "Nota geral (Likert)" continua primeiro; inativas aparecem como `Categoria: <nome> (inativa)` e continuam selecionáveis. Inativa sem nota válida não aparece.

## Evidência
| Critério | Teste |
|---|---|
| Ativas alfabéticas, inativas no fim (Alambrado inativa vem depois de Pintura, embora venha antes de Água no alfabeto) | `categorias-nota-disponiveis-319.db.spec.ts` → `['Água','banheiro','Pintura','Alambrado','Muro']`, `ativa` = `[t,t,t,f,f]` |
| Inativa sem nota válida (Calçada, resposta inválida) não aparece | mesmo teste |
| Filtros e escopo de Secretaria continuam valendo para inativas | testes de busca/Secretaria (X vê Alambrado/Muro da Creche; Y não) |
| Ordenação pura | `montarCategoriasNotaDisponiveis: inativas no fim, alfabética pt-BR em cada grupo` |
| Rótulo " (inativa)" no seletor, selecionável | `cco-categorias-nota.interacao.spec.ts` → `['Nota geral (Likert)','Categoria: Água','Categoria: Pintura','Categoria: Alambrado (inativa)']` |

Saída: `testes-319.txt`. Suíte completa: 175 arquivos / 1144 testes ok (27 pulados). `npm run build` (API) e `next build` (frontend) ok; `frontend tsc --noEmit` ok. `tsc -p tsconfig.json` na raiz tem os mesmos 29 erros pré-existentes de `main` (specs), sem erro novo.
