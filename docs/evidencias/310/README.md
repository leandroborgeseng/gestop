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
1. Sem notificação ao destino (backlog). 2. Equipe/responsável incompatível: só aviso. 3. Compatível: responsável com todas as Secretarias; equipe sem Secretaria.
4. **Acesso (decisão final, substitui "equipe não dá acesso"):**
   - Ver e executar (lista, detalhe, ações de execução): Secretaria de execução, Secretaria do próprio ou Secretaria da equipe atribuída (regra de `main`, restaurada em `secretaria-scope.ts`). Pelo próprio sem equipe: só leitura.
   - Editar a abertura, devolver e transferir: só a Secretaria de execução (`assertChamadoGestaoAberturaAccess`); senão **403** "Sem permissão para alterar a abertura: a Secretaria responsável pela execução deste chamado é outra. Você pode ver e executar, mas não editar, devolver ou transferir." Nunca 500.
   - Sem nenhum caminho: `GET /chamados/:id` → **404** "Chamado não encontrado na sua Secretaria ativa."; escrita → 403.
   - O detalhe expõe `podeGerirAbertura`; a tela esconde os lápis da abertura e mostra o aviso quando é `false`.
5. **UI após transferir:** só fecha o detalhe (mensagem + lista atualizada) se o usuário perdeu a visualização (`saiuDoEscopo`). Se continua vendo pelo próprio/equipe (`somenteExecucao`), o detalhe fica aberto em modo só leitura/execução com o aviso.

Evidências (`log.json` → `tl48`):
- `CH-2026-ZZ310T` (próprio ZZTB, equipe ZZTA, ZZTA → ZZTB), gestor ZZTA: ver 200 (`podeGerirAbertura:false`), planejamento (execução) 200, editar 403, devolver 403 com a mensagem; admin 200. `desktop-4-transferido-via-equipe-continua-so-execucao.png`: detalhe aberto, aviso, sem lápis.
- `CH-2026-ZZ310S` (próprio ZZTB, sem equipe), gestor ZZTA: ver 404, editar/devolver 403 ("Chamado fora da secretaria autorizada."). `desktop-6` (detalhe fechado, fora da lista, snackbar) e `desktop-5` (link direto → "Você não tem acesso a este chamado").
