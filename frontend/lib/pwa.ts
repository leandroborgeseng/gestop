'use client';

export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  const register = () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Falha silenciosa: PWA e opcional.
    });
  };

  if (document.readyState === 'complete') {
    register();
  } else {
    window.addEventListener('load', register, { once: true });
  }
}

/** Coleta URLs do shell já carregado (HTML + /_next/static) e pede ao SW para cachear. */
export async function prepareOfflineShell() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  registerServiceWorker();
  const registration = await navigator.serviceWorker.register('/sw.js').catch(() => null);
  if (!registration) return;

  await navigator.serviceWorker.ready;

  const urls = new Set<string>([
    '/mobile',
    '/icon.svg',
    '/icon-maskable.svg',
    '/manifest.webmanifest',
    window.location.pathname,
  ]);

  for (const entry of performance.getEntriesByType('resource') as PerformanceResourceTiming[]) {
    try {
      const resourceUrl = new URL(entry.name);
      if (resourceUrl.origin !== window.location.origin) continue;
      if (
        resourceUrl.pathname.startsWith('/_next/static/') ||
        resourceUrl.pathname === '/icon.svg' ||
        resourceUrl.pathname === '/icon-maskable.svg' ||
        resourceUrl.pathname === '/manifest.webmanifest' ||
        resourceUrl.pathname === '/mobile'
      ) {
        urls.add(resourceUrl.href);
      }
    } catch {
      // ignora
    }
  }

  document.querySelectorAll('script[src], link[rel="stylesheet"][href], link[rel="preload"][href]').forEach((node) => {
    const el = node as HTMLScriptElement | HTMLLinkElement;
    const href = 'src' in el && el.src ? el.src : 'href' in el ? el.href : '';
    if (!href) return;
    try {
      const resourceUrl = new URL(href, window.location.origin);
      if (resourceUrl.origin === window.location.origin) {
        urls.add(resourceUrl.href);
      }
    } catch {
      // ignora
    }
  });

  // Garante HTML fresco do shell de vistoria
  try {
    const shellResponse = await fetch('/mobile', { credentials: 'same-origin', cache: 'reload' });
    if (shellResponse.ok) {
      urls.add('/mobile');
      const html = await shellResponse.text();
      const srcMatches = html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g);
      for (const match of srcMatches) {
        urls.add(match[1]);
      }
    }
  } catch {
    // mantém o que já estiver na página
  }

  const worker = registration.active ?? registration.waiting ?? registration.installing;
  worker?.postMessage({ type: 'CACHE_URLS', urls: [...urls] });
}

export function subscribePwaUpdates(onUpdate: () => void) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return () => {};

  let registration: ServiceWorkerRegistration | undefined;
  let refreshing = false;

  function notifyIfWaiting(worker: ServiceWorker | null) {
    if (worker?.state === 'installed' && navigator.serviceWorker.controller) {
      onUpdate();
    }
  }

  navigator.serviceWorker
    .register('/sw.js')
    .then((reg) => {
      registration = reg;
      if (reg.waiting) onUpdate();

      reg.addEventListener('updatefound', () => {
        notifyIfWaiting(reg.installing);
        reg.installing?.addEventListener('statechange', () => notifyIfWaiting(reg.installing));
      });
    })
    .catch(() => undefined);

  const onControllerChange = () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  };

  navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

  const interval = window.setInterval(() => {
    registration?.update().catch(() => undefined);
  }, 60 * 60 * 1000);

  return () => {
    window.clearInterval(interval);
    navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
  };
}

export async function applyPwaUpdate() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    window.location.reload();
    return;
  }

  const registration = await navigator.serviceWorker.getRegistration();
  if (registration?.waiting) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    return;
  }

  window.location.reload();
}

export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function showLocalNotification(title: string, body: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => registration.showNotification(title, { body, icon: '/icon.svg' }))
      .catch(() => new Notification(title, { body, icon: '/icon.svg' }));
    return;
  }

  new Notification(title, { body, icon: '/icon.svg' });
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;

export function bindPwaInstallPrompt() {
  if (typeof window === 'undefined') return () => {};

  const handler = (event: Event) => {
    event.preventDefault();
    deferredInstallPrompt = event as BeforeInstallPromptEvent;
  };

  window.addEventListener('beforeinstallprompt', handler);
  return () => window.removeEventListener('beforeinstallprompt', handler);
}

export function hasPwaInstallPrompt() {
  return Boolean(deferredInstallPrompt);
}

export async function triggerPwaInstall() {
  if (!deferredInstallPrompt) return false;
  await deferredInstallPrompt.prompt();
  const choice = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  return choice.outcome === 'accepted';
}

export function isStandalonePwa() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

export async function enableWebPush(vapidPublicKey: string) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Push nao suportado neste navegador.');
  }

  const granted = await requestNotificationPermission();
  if (!granted) throw new Error('Permissao de notificacao negada.');

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });

  return subscription.toJSON();
}
