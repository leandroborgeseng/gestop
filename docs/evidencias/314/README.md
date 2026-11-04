# Evidências 314 · Administração > Próprios: botão Abrir (consulta)

Ambiente local: banco `gestop_314_test`, API em :3201 e web em :3200 (build de produção). Dados sintéticos ZZTESTE: Secretarias ZZTA e ZZTB, mais 30 próprios "ZZTESTE Escola extra N" na ZZTA para ter rolagem. Usuários: `zzteste.admin@aion.local` (todas as Secretarias) e `zzteste.gestor.alfa@aion.local` (só ZZTA).

| Arquivo | O que mostra |
|---|---|
| desktop-1 / mobile-1 `-admin-proprios-botao-abrir.png` | Botão **Abrir** junto de Editar/Inativar, com filtro "Escola extra" e a lista rolada (desktop 1440×900, mobile 390×844) |
| desktop-2 / mobile-2 `-pagina-completa-cco.png` e `-2b-topo-com-voltar.png` | A mesma página completa do CCO (`/cco/unidades/:id`), aberta pelo id |
| desktop-3 / mobile-3 `-voltar-filtro-e-rolagem-preservados.png` | Voltar leva a `/admin?aba=unidades` com a aba Próprios, o filtro e a rolagem iguais (y 2036→2036 no desktop, 3329→3329 no mobile) |
| desktop-4 `-gestor-alfa-proprio-de-outra-secretaria.png` | Gestor da ZZTA abrindo pelo id um próprio da ZZTB: a API responde 404 e a tela mostra "Proprio publico nao encontrado" |
| log.json | URLs, posição de rolagem, valor do filtro e aba lidos em cada passo |
