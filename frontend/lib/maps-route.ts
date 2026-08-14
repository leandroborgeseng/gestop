/** Abre rota até as coordenadas em app de navegação / Google Maps. */
export function openMapsRoute(latitude: number, longitude: number, endereco?: string | null) {
  const hasCoords =
    Number.isFinite(latitude) && Number.isFinite(longitude) && !(latitude === 0 && longitude === 0);
  const destination = hasCoords ? `${latitude},${longitude}` : endereco?.trim() || '';
  if (!destination) return;

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const isAppleMobile = /iPad|iPhone|iPod/.test(ua);
  const encoded = encodeURIComponent(destination);

  let url: string;
  if (isAppleMobile) {
    url = `maps://?daddr=${encoded}`;
  } else if (isMobile) {
    url = hasCoords ? `geo:${latitude},${longitude}?q=${encoded}` : `geo:0,0?q=${encoded}`;
  } else {
    url = `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}
