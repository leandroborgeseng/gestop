# 308 · Cronogramas cadastrados: inativos

Ambiente local `_test` (Postgres embarcado, banco `gestop_308_test`), dados sintéticos ZZTESTE/@aion.local. Medições em `log.json`. Horários de auditoria gravados em UTC (21:20 UTC = 18:20 BRT, 04/11/2026).

| Critério | Evidência |
|---|---|
| Só ativos por padrão | `desktop-1`: 2 ativos visíveis, 2 inativos na sanfona fechada (`log.inicio`) |
| Sanfona "Mostrar/Ocultar cronogramas inativos (N)" com tag Inativo e Reativar | `desktop-2`, `mobile-1` (`log.sanfonaAberta`); inativo sem Editar |
| Reativar com confirmação | `desktop-3` (texto explica recálculo só da próxima data) |
| Reativar recalcula só a próxima data, sem retroativas | Área de lazer Alfa (semanal): próxima 01/10/2026 → 05/11/2026 (1º passo ≥ hoje); nenhum evento dela antes de hoje no calendário (`log.reativado`); `desktop-4` |
| Inativar com confirmação | `desktop-5`; repetir a ação → 409 |
| Inativos fora do calendário/programações | calendário set–dez sem o inativo (`calendarioSemInativos`); `/mobile/vistorias-programadas` contém o reativado e não o inativado (`log.programacoes`) |
| Auditoria | `LogAuditoria` STATUS_CHANGE "Cronograma reativado" (próxima 2026-10-01 → 2026-11-05, ativo true) e "Cronograma inativado" (ativo false), com usuário, instante e Secretaria ativa |
| Permissões | sem permissão de cronograma (zzteste.consulta.alfa) → 403 em Inativar e Reativar; Inativar/Reativar usam a permissão de excluir (como no 309); sem ela os botões não aparecem (teste de interação) |
| Secretaria | gestor ZZTB → 404 ao inativar/reativar cronograma de ZZTA e lista vazia |

Testes: `frontend/components/cronograma/cronogramas-cadastrados.interacao.spec.ts` (6 casos, jsdom + Testing Library), `src/cronograma/cronogramas-inativos-308.db.spec.ts` (5 casos, Postgres local), `src/cronograma/cronograma.rules.spec.ts` (recálculo).

## Decisões do TL no PR #47 + pedidos do Tester (`log.json → decisoesTL47`)

| Item | Resultado |
|---|---|
| 1. Editar cronograma inativo | PUT → **409** "Este cronograma está inativo. Reative-o para realizar alterações" |
| 2. Reativar com próprio/checklist inativo | **409** `DEPENDENCIA_INATIVA` com o motivo, ex.: "Não é possível reativar: o checklist "ZZTESTE Checklist 308 Elétrica" está inativo. Reative o checklist primeiro."; o card inativo já avisa qual reativar antes (`desktop-6`) |
| 3. Par próprio + checklist com cronograma inativo | formulário mostra "Já existe um cronograma inativo para este próprio e checklist" + Reativar (com confirmação) e desabilita Cadastrar (`desktop-7`); reativar pelo formulário funcionou |
| Tester (b): par duplicado nunca 500 | API → **409** `CRONOGRAMA_INATIVO_EXISTENTE` / `CRONOGRAMA_EXISTENTE` com mensagem; na tela a mensagem aparece dentro do formulário (`desktop-8`) |
| Tester (a): próprio inativo não gera programação | cronograma ativo em ZZT-A-004 (próprio inativo) fora do calendário e de `/mobile/vistorias-programadas`; checklist inativo segue sinalizado e sem iniciar (309/C5) |
| 4. Auditoria `DELETE` | nenhum relatório ou consulta filtra `DELETE` de cronograma; mantido `STATUS_CHANGE` |
