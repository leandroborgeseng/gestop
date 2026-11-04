# Evidências 315 · CCO, aba Não conformidades: número do chamado vira link

Ambiente local: banco `gestop_315_test`, API em :3301 e web em :3300 (build de produção). Dados sintéticos ZZTESTE. O próprio ZZT-A-001 tem 2 NCs: uma com o chamado `CH-2026-ZZ0315` aberto e outra sem chamado. Usuário: `zzteste.gestor.alfa@aion.local`.

| Arquivo | O que mostra |
|---|---|
| desktop-1 / mobile-1 `-aba-nc-numero-do-chamado-link.png` | Na barra lateral do CCO, aba Não conf., o número `CH-2026-ZZ0315` aparece como link sublinhado. A NC sem chamado continua com "Sem chamado", sem link. |
| desktop-2 / mobile-2 `-tela-chamados-com-chamado-selecionado.png` | O clique abre `/chamados?id=<id>` com o chamado selecionado e o detalhe aberto (print de página inteira) |
| log.json | Texto e href do link e URL de destino |
