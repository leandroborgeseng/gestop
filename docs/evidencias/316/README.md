# 316 · CCO, filtro "Tipo de chamado" nas duas abas

Ambiente local `_test` (`gestop_310_test`), dados sintéticos ZZTESTE/@aion.local: tipos "ZZTESTE Iluminação" (40 abertos ZZTA), "ZZTESTE Poda" (concluído/em execução ZZTA), "ZZTESTE Buraco" (ZZTB) e "ZZTESTE Calçada (sem chamados)". Medições em `log.json` (04/11/2026, noite, BRT).

**Antes (main):** as opções vinham do catálogo inteiro (`/operacional/opcoes-filtro` → `tiposChamado`), sem olhar os resultados.

| Critério | Evidência |
|---|---|
| Só tipos existentes nos resultados atuais | "ZZTESTE Calçada (sem chamados)" nunca aparece (`log.json`, `desktop-1`, `desktop-3`) |
| Aba Próprios: chamados das unidades filtradas | `GET /operacional/tipos-chamado-disponiveis` = `listUnidades` (mesmos filtros, sem o tipo) + chamados abertos desses próprios (mesma regra da pendência). `desktop-3` |
| Aba Chamados: chamados filtrados, inclusive rápidos e datas | `GET /operacional/chamados-mapa/tipos-chamado-disponiveis` usa o **mesmo where** do mapa (`buildChamadosMapaWhere`, extraído de `listChamadosMapa`). Status Concluído → só Poda; "Há mais de 30 dias" → nenhum (`desktop-2`) |
| Todos os filtros exceto ele mesmo | `tipoChamadoId` é ignorado na consulta das opções (`gestorZZTA_todos_comFiltroTipoIgnorado`) |
| Conjunto inteiro (não página/zoom) e eficiente | `groupBy tipoChamadoId` + 1 `findMany` de nomes, sem o corte de 2.000 itens; teste de banco com 2.007 chamados prova que o tipo além do corte aparece. 10–42 ms localmente |
| Limpar só ele se inválido | a seleção é podada só no Tipo de chamado (teste de interação: outros filtros intactos) |
| "Nenhum tipo de chamado disponível" | `desktop-2`: combobox desabilitado + texto auxiliar |
| Sincronizado com o painel do mapa | o mesmo `CcoFiltrosPanel` serve a sanfona e o painel do mapa; testado nas duas variantes |
| Escopo de Secretaria | gestor ZZTA: Buraco (3) só pelos caminhos de acesso (próprio/equipe); admin "Todas": Buraco (6). Teste de banco: Secretaria X não vê tipo de chamado só da Y; sem Secretaria → vazio |
| Erros | data inválida → 400 "Data inicial inválida." (nunca 500); falha na consulta mantém as opções anteriores e não poda |
