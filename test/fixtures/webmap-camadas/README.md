# Fixtures 296 (formato qgis2web / SMMAFRANCA/webmap)
Gerados por `gerar.py`. `layers/layers.js` (lyr_/group_/layersList), `layers/<VAR>.js` (`var json_<VAR> = GeoJSON CRS84`), `styles/<VAR>_style.js` (ol.style Circle/Stroke/Fill/Icon; categorias por `switch/case`).
- v1: 8 camadas / 6 grupos — pontos, linha, polígonos, ícone SVG (PONTO_VICIADO), categorias (ETE 2), par polígono/ponto com o mesmo nome base (LOTE).
- v2: CRECHE_PRE_ESCOLA45UNID_78 → CRECHE_PRE_ESCOLA46UNID_77 (atualizada, mesma chave); UBS removida; VIAS_PRINCIPAIS_81 → _82 (só sufixo: mesma camada); ETE 3 → ETE 3 NORTE (renomeada: nova + antiga removida); ECOPONTO nova com 2 elementos malformados (PARCIAL); ETE 2 sem mudança.
- v3 = v1: UBS e ETE 3 voltam (reativadas, mesmo id); ETE 3 NORTE removida.
- v_quebrada: VIAS com GeoJSON truncado → FALHA, nada gravado.
