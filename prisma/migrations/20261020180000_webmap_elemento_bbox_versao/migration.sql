-- 296 (TL): índice composto versão/camada + bbox por feição. Só aditivo, sem PostGIS/extensões.
-- As colunas minLng/minLat/maxLng/maxLat (bbox da feição, calculado em JS no streaming) já existem desde 20261020150000.
CREATE INDEX "WebmapElemento_camadaId_versao_minLng_maxLng_minLat_maxLat_idx" ON "WebmapElemento"("camadaId", "versao", "minLng", "maxLng", "minLat", "maxLat");
