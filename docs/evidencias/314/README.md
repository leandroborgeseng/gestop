# Evidências 314 · Administração > Próprios: botão Abrir (consulta)

Ambiente local: banco `gestop_314_test`, API em :3201 e web em :3200 (build de produção). Dados sintéticos ZZTESTE: Secretarias ZZTA e ZZTB, mais 30 próprios "ZZTESTE Escola extra N" na ZZTA para ter rolagem. Usuários: `zzteste.admin@aion.local` (todas as Secretarias) e `zzteste.gestor.alfa@aion.local` (só ZZTA).

| Arquivo | O que mostra |
|---|---|
| desktop-1 / mobile-1 `-admin-proprios-botao-abrir.png` | Botão **Abrir** junto de Editar/Inativar, com filtro "Escola extra" e a lista rolada (desktop 1440×900, mobile 390×844) |
| desktop-2 / mobile-2 `-pagina-completa-cco.png` e `-2b-topo-com-voltar.png` | A mesma página completa do CCO (`/cco/unidades/:id`), aberta pelo id |
| desktop-3 / mobile-3 `-voltar-filtro-e-rolagem-preservados.png` | Voltar leva a `/admin?aba=unidades` com a aba Próprios, o filtro e a rolagem iguais (y 2036→2036 no desktop, 3329→3329 no mobile) |
| desktop-4 `-gestor-alfa-proprio-de-outra-secretaria.png` | Gestor da ZZTA abrindo pelo id um próprio da ZZTB: a API responde 404 e a tela mostra "Proprio publico nao encontrado" |
| log.json | URLs, posição de rolagem, valor do filtro e aba lidos em cada passo |

## Decisões do TL (rodada 2)
| Arquivo | O que mostra |
|---|---|
| desktop-5-pagina-cco-abre-no-topo.png | Ao abrir pela lista rolada (y=2036), a página do CCO abre com scrollY=0 |
| desktop-6-voltar-do-navegador-aba-proprios.png | Ao trocar de aba, a URL muda (`?aba=usuarios`, depois `?aba=unidades`). O **Voltar do navegador** cai em `/admin?aba=unidades`, na aba Próprios, com o filtro e a rolagem mantidos |
| desktop-7-proprio-inativo-aviso.png | O próprio inativo ZZT-A-004 mostra o aviso **Inativo** no topo da página |
| desktop-8-drawer-cco-admin-global-proprio-zzta.png, desktop-8-drawer-cco-gestor-zzta-proprio-zzta.png | Regressão do drawer do CCO: ele continua abrindo para o admin global e para o gestor ZZTA num próprio da ZZTA |
| drawer-regressao-curl.txt | `GET /operacional/unidades/:id`: admin com ZZTA dá 200, gestor ZZTA com ZZTA dá 200, gestor ZZTA com ZZTB dá 404. Sem tokens no arquivo |

**Causa da abertura no meio da página:** a restauração de rolagem do Voltar não era aplicada na página errada. Só a aba Próprios da Administração lê e consome o `sessionStorage`. A causa era a navegação do App Router: o layout autenticado é compartilhado, e o Next só leva o segmento novo para a área visível, sem zerar a rolagem da janela. Por isso a página herdava o `scrollY` da lista. A correção é um `window.scrollTo(0, 0)` ao montar a página e a cada troca de `id`.
