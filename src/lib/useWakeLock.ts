import { useEffect } from 'react';

/**
 * Hält den Bildschirm an, solange `active` true ist (Screen Wake Lock API).
 * Wird nicht unterstützt → still ignorieren. iOS gibt den Lock beim Verlassen
 * der App frei, darum beim Zurückkehren neu anfordern.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const request = async () => {
      try {
        if (document.visibilityState !== 'visible' || (sentinel && !sentinel.released)) return;
        sentinel = await navigator.wakeLock.request('screen');
        if (cancelled) void sentinel.release().catch(() => {});
      } catch {
        /* nicht erlaubt / nicht unterstützt */
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void request();
    };

    void request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release().catch(() => {});
    };
  }, [active]);
}
