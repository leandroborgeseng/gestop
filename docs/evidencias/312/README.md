# Evidências 312 · CCO, filtro Tipo de próprio (PR #43)

Ambiente local: Postgres embutido, banco `gestop_312_test`, API em :3101 e web em :3100 (build de produção do Next). Dados 100% sintéticos (prefixo ZZTESTE / ZZT, usuários `@aion.local`).
- Secretaria ZZTA: Escola, Praça, Área de lazer (ativos) e Obra parada (próprio **inativo**)
- Secretaria ZZTB: UBS, Ginásio

| Arquivo | Critério | O que mostra |
|---|---|---|
| 01-lista-populada-nome-ordem.png | B1, B2, B3 | Admin global vê só o Nome, em ordem alfabética com acento certo ("Área…" primeiro). "Obra parada" não aparece porque o próprio é inativo. O `<select>` foi aberto com `size` só para o print. |
| 02-b4-antes-ZZTA-escola.png | B4 | Filtros ZZTA, Escola e bairro ZZ Centro |
| 03-b4-depois-ZZTB-tipo-limpo-bairro-mantido.png | B4 | Ao trocar para ZZTB, só o tipo Escola é removido. Secretaria e Bairro continuam. |
| 04-lista-vazia-nenhum-tipo-disponivel.png | Lista vazia | ZZTB com ZZ Centro não tem próprios, e aparece "Nenhum tipo disponível" |
| 05-b5-tela-para-painel.png | B5 (tela → painel) | Praça escolhida na tela aparece selecionada no painel do mapa |
| 06-b5-painel-aplicado.png, 07-b5-tela-reflete-painel.png | B5 (painel → tela) | UBS adicionada no painel e "Aplicar filtros" fazem a tela mostrar Praça e UBS |
| log.json | B1–B5 | Opções e chips lidos do DOM em cada passo |
| b6-curl-gestor-alfa.txt | B6 | API com usuário restrito à ZZTA: só tipos da ZZTA. Pedindo `secretariaIds` da ZZTB, a resposta é `[]`. O admin aparece como controle. Sem tokens no arquivo. |
