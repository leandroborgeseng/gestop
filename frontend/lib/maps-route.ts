/** Abre rota até as coordenadas em app de navegação / Google Maps. */
export function openMapsRoute(latitude: number, longitude: number) {
  const destination = `${latitude},${longitude}`;
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const isAppleMobile = /iPad|iPhone|iPod/.test(ua);

  let url: string;
  if (isAppleMobile) {
    // iOS: esquema maps:// costuma oferecer escolha de app de navegação.
    url = `maps://?daddr=${destination}`;
  } else if (isMobile) {
    // Android e demais mobile: geo: abre o seletor de apps de navegação.
    url = `geo:${latitude},${longitude}?q=${destination}`;
  } else {
    url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}
