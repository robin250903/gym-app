// Pausentimer über einen Endzeitpunkt (Timestamp) statt heruntergezählter Intervalle.
// iOS pausiert JavaScript im Hintergrund – beim Zurückkehren stimmt die Restzeit trotzdem,
// weil sie immer aus endAt - Date.now() berechnet wird. Der Zustand liegt in localStorage,
// damit er auch ein Neuladen der App übersteht.
import { useSyncExternalStore } from 'react';

export interface RestTimerState {
  endAt: number;
  durationSec: number;
  label: string;
  /** Wurde das Ende schon signalisiert (Ton)? */
  alerted: boolean;
}

const KEY = 'gym.restTimer';
let state: RestTimerState | null = load();
const listeners = new Set<() => void>();

function load(): RestTimerState | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RestTimerState) : null;
  } catch {
    return null;
  }
}

function set(next: RestTimerState | null) {
  state = next;
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    /* privater Modus o. Ä. */
  }
  listeners.forEach((l) => l());
}

export const restTimer = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  start(durationSec: number, label: string) {
    set({ endAt: Date.now() + durationSec * 1000, durationSec, label, alerted: false });
  },
  /** Zeit hinzufügen (+30 s) oder abziehen (-15 s) */
  adjust(deltaSec: number) {
    if (!state) return;
    const endAt = Math.max(Date.now(), state.endAt + deltaSec * 1000);
    set({ ...state, endAt, durationSec: Math.max(1, state.durationSec + deltaSec), alerted: endAt <= Date.now() && state.alerted });
  },
  markAlerted() {
    if (state && !state.alerted) set({ ...state, alerted: true });
  },
  stop() {
    set(null);
  },
};

export function remainingSec(s: RestTimerState, now = Date.now()): number {
  return (s.endAt - now) / 1000;
}

export function useRestTimer(): RestTimerState | null {
  return useSyncExternalStore(restTimer.subscribe, restTimer.get, restTimer.get);
}
