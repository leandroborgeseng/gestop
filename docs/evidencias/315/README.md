# Evidências 315 · CCO, aba Não conformidades: número do chamado vira link

Ambiente local: banco `gestop_315_test`, API em :3301 e web em :3300 (build de produção). Dados sintéticos ZZTESTE. O próprio ZZT-A-001 tem 2 NCs: uma com o chamado `CH-2026-ZZ0315` aberto e outra sem chamado. Usuário: `zzteste.gestor.alfa@aion.local`.

| Arquivo | O que mostra |
|---|---|
| desktop-1 / mobile-1 `-aba-nc-numero-do-chamado-link.png` | Na barra lateral do CCO, aba Não conf., o número `CH-2026-ZZ0315` aparece como link sublinhado. A NC sem chamado continua com "Sem chamado", sem link. |
| desktop-2 / mobile-2 `-tela-chamados-com-chamado-selecionado.png` | O clique abre `/chamados?id=<id>` com o chamado selecionado e o detalhe aberto (print de página inteira) |
| log.json | Texto e href do link e URL de destino |

## Decisões do TL (rodada 2)
Dados adicionais: NC resolvida com o chamado `CH-2026-ZZ0316` CONCLUIDO e NC com o chamado `CH-2026-ZZ0317` EM_EXECUCAO.

| Arquivo | O que mostra |
|---|---|
| desktop-3-aba-nc-resolvida-e-execucao-com-link.png | A NC resolvida mostra o selo **Resolvida** e, ao lado, o número como link. A NC em execução e a vinculada também mostram o link. A NC sem chamado continua sem link. |
| desktop-4-link-em-execucao-abre-execucao.png | `CH-2026-ZZ0317`, que está em execução, abre `/execucao/:id`, igual à aba Chamados do drawer |
| desktop-5-link-resolvida-abre-chamados-selecionado.png | `CH-2026-ZZ0316`, que está resolvido, abre `/chamados?id=` com o chamado selecionado |
| log.json (`decisoesTL`) | Código, href e selo de cada link e as URLs de destino |

A aba Não conf. e a aba Chamados do drawer usam o mesmo helper (`hrefChamado` em `frontend/lib/nc-chamado-link.ts`).

## Decisões do TL (rodada 3): permissão e Secretaria
Dados adicionais: usuário `zzteste.consulta.alfa@aion.local` (ZZTA, só CCO, sem Chamados nem Execução). Chamados da ZZTB: `CH-2026-ZZB001` ABERTO e `CH-2026-ZZB002` EM_EXECUCAO.

| Arquivo | O que mostra |
|---|---|
| desktop-6-usuario-sem-permissao-chamados-so-selo.png | Usuário sem permissão de Chamados vê só o selo com o número, sem link (`log.json`: `semPermissaoChamados.links = 0`) |
| desktop-7-gestor-zzta-chamados-de-outra-secretaria.png | Gestor da ZZTA abrindo `/chamados?id=<chamado da ZZTB>` vê **"Você não tem acesso a este chamado"**. O detalhe fica em "Selecione um chamado" e a tela não cai no primeiro chamado da lista. |
| desktop-8-gestor-zzta-execucao-de-outra-secretaria.png | Gestor da ZZTA abrindo `/execucao/<chamado da ZZTB>` vê **"Você não tem acesso a este chamado"** |

O backend já respondia 403 nos dois casos. A mudança foi só no frontend: 403 ou 404 vira a mensagem de sem acesso.
