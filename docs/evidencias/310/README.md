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
