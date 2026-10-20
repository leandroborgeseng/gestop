-- 296 (TL): feição sem conserto é gravada com a geometria original e marcada; não é desenhada no mapa.
-- Só aditivo (coluna nova com default; bbox passa a aceitar NULL para geometria sem coordenadas). Sem extensões.
ALTER TABLE "WebmapElemento" ADD COLUMN "geometriaInvalida" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "WebmapElemento" ALTER COLUMN "minLng" DROP NOT NULL;
ALTER TABLE "WebmapElemento" ALTER COLUMN "minLat" DROP NOT NULL;
ALTER TABLE "WebmapElemento" ALTER COLUMN "maxLng" DROP NOT NULL;
ALTER TABLE "WebmapElemento" ALTER COLUMN "maxLat" DROP NOT NULL;
