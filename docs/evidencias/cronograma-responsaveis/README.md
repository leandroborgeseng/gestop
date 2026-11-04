# Cronograma · campo Responsáveis (item sem número, entre 305 e 308)

Ambiente local `_test` (Postgres embarcado, banco `gestop_resp_test`), dados sintéticos ZZTESTE/@aion.local (`seed-sintetico.ts`). Medições em `log.json`.

| Critério | Evidência |
|---|---|
| Lista no fluxo do formulário, empurra campos, não sobrepõe Salvar | `desktop-1`, `mobile-1` (lista `position: static` dentro do corpo rolável do modal); `desktop-5`, `mobile-5`: rolando até o fim, a lista termina acima do rodapé (782 < 796 px; 780 < 794 px) |
| Altura confortável com rolagem própria | desktop `max-height: 288px` (~6 itens), mobile 50dvh; `scrollHeight 576 > clientHeight` → rola por dentro |
| Fecha com clique fora / Esc / clique no campo | `log.json` (`esc`, `cliqueFora`); Esc fecha só a lista, o modal continua; `desktop-2`, `mobile-2` |
| Multisseleção mantida | marcar 2 mantém a lista aberta e cria 2 chips (`aposMarcar2`) |
| Usuários filtrados no backend pela Secretaria ativa (inclui vínculo múltiplo) | gestor ZZTA vê Alfa 1–9, gestor, consulta e **Multi (A+B)**; não vê Beta nem o Inativo |
| "Todas as Secretarias" conforme autorização, sem duplicar | `desktop-4`: admin vê só os grupos ZZTA/ZZTB; Multi aparece 1 vez com "ZZTA, ZZTB" |
| Edição preserva inativos/outra Secretaria com indicação | `desktop-3`: chips "Inativo" e "Outra Secretaria" + aviso "2 responsáveis precisam ser regularizados."; opções novas não incluem Beta/Inativo |
| Sem novas atribuições inválidas | backend: novo de outra Secretaria → 403, novo inativo → 400 (`src/cronograma/responsaveis-cronograma.db.spec.ts`, 12/12 em Postgres local) |

Testes de interação (jsdom + Testing Library, comportamento real do componente): `frontend/components/cronograma/responsaveis-combobox.interacao.spec.ts` (7 casos).

## Decisão do TL no PR #46: admin global sem Secretaria fora das opções

- Backend (`listResponsaveisOpcoes`): só oferece usuários com Secretaria principal ou vínculo (`whereUsuarioComSecretaria`). O grupo "Sem Secretaria" sumiu (`desktop-4`, `log.json → adminTodas.grupos = ["ZZTA","ZZTB"]`).
- Atribuição NOVA de usuário sem Secretaria → 400 (mesma regra do inativo).
- Já atribuído continua: o cronograma sintético recebeu `zzteste.admin` direto no banco; na edição o chip aparece com indicação "Outra Secretaria" para o gestor ZZTA (`desktop-3`) e salvar mantendo-o funciona (teste de banco).
- Testes: `responsaveis-cronograma.db.spec.ts` (novo caso, 13/13 no Postgres local) e `responsaveis-combobox.interacao.spec.ts` (novo caso, 8/8).
