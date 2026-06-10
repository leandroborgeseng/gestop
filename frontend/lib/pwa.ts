'use client';

export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Falha silenciosa: PWA e opcional.
    });
  });
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
