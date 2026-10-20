/**
 * 299 — flags de frontend.
 * NEXT_PUBLIC_WEBMAP_CAMADAS_MAPA: mostra as camadas do Webmap no mapa (aba Camadas do CCO e Agente de Campo).
 * Padrão DESLIGADA: só "true" liga. A importação da 296 (Administração › Importação) não depende desta flag.
 * Lida na chamada (o Next inlina NEXT_PUBLIC_* no build; nos testes dá para trocar o env).
 */
export function webmapCamadasMapaAtivo(): boolean {
  return process.env.NEXT_PUBLIC_WEBMAP_CAMADAS_MAPA === 'true';
}
