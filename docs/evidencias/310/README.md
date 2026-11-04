# 310 · Chamados: "Secretaria responsável pela execução"

Ambiente local `_test` (banco `gestop_310_test`), dados sintéticos ZZTESTE/@aion.local: Secretarias ZZTA, ZZTB, ZZTG (ativas) e ZZTX (inativa); gestor ZZTA; equipe "ZZTESTE Equipe Alfa" (ZZTA). Medições em `log.json`. Horários de auditoria em UTC (21:47 UTC = 18:47 BRT, 04/11/2026).

| Critério | Evidência |
|---|---|
| Lista todas as Secretarias ativas, independente do contexto | gestor com Secretaria ativa ZZTA: `/operacional/secretarias` → só ZZTA; novo `/chamados/secretarias/destino-execucao` → ZZTA, ZZTB, ZZTG (sem a inativa ZZTX); `desktop-1` |
| Só para quem tem permissão de alterar | zzteste.consulta.alfa → 403 no endpoint e no salvar; sem lápis (teste de interação) |
| Backend aceita | ZZTA → ZZTB salvo; Secretaria inexistente/inativa → 400 com mensagem |
| Histórico/auditoria origem → destino | `HistoricoStatus.metadata.secretariaExecucao` {origem, destino, revisar} + alteração "Secretaria responsável pela execução" de → para; `LogAuditoria` funcao `secretaria_execucao`, descrição "Secretaria responsável pela execução: ZZTA → ZZTB" |
| Não altera a Secretaria do próprio | depois da troca: chamado ZZTB, próprio continua ZZTA (`log.depois`, `desktop-3`) |
| Orienta revisão de equipe/responsável incompatível | `desktop-2`: "A equipe atual é de outra Secretaria…" e "O responsável atual não pertence à Secretaria de destino…"; equipe/responsável **não** são limpos |
| Notificar destino se já houver rotina | não há rotina de notificação por troca/entrada de chamado na Secretaria (só "Notificar equipe" manual e alertas operacionais a gestores) → não implementado |
| Erros visíveis no campo, nunca 500/cru | erro de salvar e de carregar a lista aparecem dentro do campo (teste de interação); quando o usuário perde o acesso após a troca, mensagem clara (`desktop-4`) e um novo salvar responde 403 com mensagem |

## Decisões do TL (PR #48)
1. Sem notificação ao destino (fica no backlog).
2. Equipe/responsável incompatível: só aviso (não limpa).
3. Compatível: responsável com acesso a todas as Secretarias; equipe sem Secretaria.
4. Quem perde o acesso após transferir: o detalhe fecha na hora, com a mensagem, e a lista é atualizada (`desktop-4`).
5. **O acesso segue a Secretaria do chamado, não a equipe.** Removido o caminho de acesso pela equipe atribuída (`resolveChamadoSecretariaFilter`, `assertChamadoSecretariaAccess`, `assertChamadoExecucaoAccess`). A equipe da origem fica só como dado, com o aviso de revisar.
   - Gestor da origem sem acesso ao destino: `GET /chamados/:id` → **404** "Chamado não encontrado na sua Secretaria ativa."; `PUT /chamados/:id/abertura` (editar ou devolver) → **403** "Sem permissão de tratativa: a Secretaria responsável pela execução deste chamado é outra." (nunca 500). O chamado também sai da lista dele.
   - Quem tem acesso ao destino vê, edita e pode devolver.
   - Evidência: `log.json` → `tl48` (chamado `CH-2026-ZZ310T`: próprio ZZTB, equipe ZZTA, execução ZZTA → ZZTB): 404/403 com as mensagens acima, admin 200; `desktop-4` (detalhe fechado, fora da lista, snackbar) e `desktop-5` (link direto → "Você não tem acesso a este chamado", sem cair em outro chamado).
   - Mantido: a Secretaria **do próprio** continua vendo o chamado (regra anterior, item "visualização permite próprio da secretaria mesmo com execução diferente"), só para leitura: editar/devolver → 403. Teste de banco cobre esse caso.
