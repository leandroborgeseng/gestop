# 310-excluir · Excluir chamado só pela Secretaria responsável pela execução

Ambiente local `_test` (`gestop_310_test`), dados sintéticos ZZTESTE/@aion.local. Usuário: gestor ZZTA, **com** a permissão `chamados.excluir_logicamente`. Medições em `log.json` (horário: 04/11/2026, noite, BRT).

| Critério | Evidência |
|---|---|
| Excluir exige a Secretaria de execução; senão 403 com mensagem clara | `CH-2026-ZZ310N` (execução ZZTB, equipe ZZTA): `POST /chamados/:id/exclusao-logica` → **403** "Sem permissão para excluir: a Secretaria responsável pela execução deste chamado é outra. Só ela pode excluir o chamado." |
| Botão "Excluir chamado" some quando `podeGerirAbertura` é false | `desktop-1-via-equipe-sem-botao-excluir.png` (`ui.botaoExcluir: 0`, aviso de só leitura/execução visível). A lista agora também leva `podeGerirAbertura`, então o botão já some ao abrir o chamado pela lista |
| Mensagem clara no caso sem nenhum caminho | `CH-2026-ZZ310S` (execução ZZTB, sem equipe): ver → 404; editar/excluir → 403 "Você não tem acesso a este chamado: ele não é da sua Secretaria ativa (nem pela execução, pelo próprio ou pela equipe)." (antes: "Chamado fora da secretaria autorizada.") |
| Regressão sem transferência (equipe de outra Secretaria) | `CH-2026-ZZ310N`, nunca transferido: ver 200 (na lista), planejamento 200, editar/devolver/transferir/excluir 403 com mensagem |
| Secretaria de execução exclui | teste de banco: gestor ZZTB exclui (excluidoEm preenchido) |

Testes: `src/chamados/secretaria-execucao-310.db.spec.ts` (13), `src/auth/secretaria-scope.spec.ts`, `frontend/components/chamados/chamado-excluir-secretaria-execucao.interacao.spec.ts` (3).
