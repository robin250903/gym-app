// Minimaler Hash-Router (#/verlauf/123). Hash-Routing funktioniert auf GitHub Pages
// ohne Server-Konfiguration und offline im Standalone-Modus.
import { useSyncExternalStore } from 'react';

function current(): string {
  return location.hash.replace(/^#\/?/, '');
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

/** Aktuelle Route als Segmente, z. B. ['verlauf', '123'] */
export function useRoute(): string[] {
  const path = useSyncExternalStore(subscribe, current, current);
  return path.split('/').filter(Boolean).map(decodeURIComponent);
}

export function navigate(path: string, replace = false): void {
  const target = `#/${path.replace(/^\//, '')}`;
  if (replace) {
    history.replaceState(null, '', target);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    location.hash = target;
  }
}

export function goBack(fallback: string): void {
  if (history.length > 1) history.back();
  else navigate(fallback, true);
}
