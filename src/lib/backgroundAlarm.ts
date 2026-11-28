// Timer-Ton auch, wenn die App im Hintergrund ist oder der Bildschirm gesperrt ist.
//
// iOS hält JavaScript und Web Audio im Hintergrund an, ein laufendes <audio>-Element spielt aber weiter.
// Darum wird beim Start einer Pause eine WAV-Datei erzeugt, die genau so lange still ist wie die Pause
// und am Ende piept, und sofort abgespielt (noch im Tap, sonst blockiert iOS das Abspielen).
// Nachteil: Mit der Audio-Session 'playback' pausiert iOS währenddessen Musik aus anderen Apps.
// Darum lässt sich das in den Einstellungen abschalten.
import { buildAlarmWav } from './alarmWav';
import { restTimer, type RestTimerState } from './restTimer';
import { setAudioSessionType } from './sound';

const SETTING_KEY = 'gym.bgSound';
/** Abweichung, ab der die Wiedergabeposition an die echte Restzeit angepasst wird. */
const MAX_DRIFT_SEC = 0.5;

let audio: HTMLAudioElement | null = null;
let url: string | null = null;
/** endAt des Timers, für den gerade eine Datei läuft (bzw. gelaufen ist). */
let scheduledEndAt: number | null = null;
/** Position in der Datei, an der das Signal beginnt (= Länge der Stille). */
let silenceSec = 0;
/** Hat die Wiedergabe wirklich angefangen? (play() kann von iOS abgelehnt werden) */
let started = false;

export function isBackgroundSoundEnabled(): boolean {
  try {
    return localStorage.getItem(SETTING_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setBackgroundSoundEnabled(on: boolean): void {
  try {
    localStorage.setItem(SETTING_KEY, on ? 'on' : 'off');
  } catch {
    /* privater Modus o. Ä. */
  }
  sync();
}

function getAudio(): HTMLAudioElement {
  if (audio) return audio;
  const a = new Audio();
  a.preload = 'auto';
  a.setAttribute('playsinline', '');
  a.addEventListener('playing', () => {
    started = true;
    resync();
  });
  a.addEventListener('ended', () => {
    setAudioSessionType('ambient');
    setMediaInfo(null);
  });
  audio = a;
  return a;
}

/** Wiedergabeposition an die echte Restzeit anpassen (z. B. wenn der Start etwas gedauert hat). */
function resync() {
  if (!audio || scheduledEndAt == null || audio.paused) return;
  const expected = silenceSec - (scheduledEndAt - Date.now()) / 1000;
  if (expected >= silenceSec) return; // Signal läuft schon oder ist vorbei
  if (Math.abs(audio.currentTime - expected) > MAX_DRIFT_SEC) {
    try {
      audio.currentTime = Math.max(0, expected);
    } catch {
      /* ignorieren */
    }
  }
}

function play(silence: number, endAt: number, title: string) {
  const a = getAudio();
  release();
  url = URL.createObjectURL(new Blob([buildAlarmWav(silence)], { type: 'audio/wav' }));
  silenceSec = silence;
  scheduledEndAt = endAt;
  started = false;
  setAudioSessionType('playback');
  a.src = url;
  setMediaInfo(title);
  void a.play().catch(() => {
    // iOS hat das Abspielen blockiert → beim Zurückkehren in die App piept dann wie bisher Web Audio
    started = false;
    setAudioSessionType('ambient');
  });
}

function release() {
  if (audio) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }
  if (url) URL.revokeObjectURL(url);
  url = null;
  scheduledEndAt = null;
  started = false;
}

function cancel() {
  if (scheduledEndAt == null && !url) return;
  release();
  setAudioSessionType('ambient');
  setMediaInfo(null);
}

/** Sperrbildschirm zeigt „Pause · Übung“ samt Fortschritt an. */
function setMediaInfo(title: string | null) {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = title
      ? new MediaMetadata({
          title,
          artist: 'Gym',
          artwork: [{ src: `${import.meta.env.BASE_URL}icon-512.png`, sizes: '512x512', type: 'image/png' }],
        })
      : null;
  } catch {
    /* ignorieren */
  }
}

/** Gleicht die Audio-Datei mit dem aktuellen Timer ab. Läuft synchron im Tap, der den Timer ändert. */
function sync() {
  const s: RestTimerState | null = restTimer.get();
  if (!s || !isBackgroundSoundEnabled()) {
    cancel();
    return;
  }
  if (s.endAt === scheduledEndAt) return; // z. B. nur markAlerted()
  const remaining = (s.endAt - Date.now()) / 1000;
  if (remaining <= 0.3) {
    cancel(); // schon vorbei → RestTimerBar piept selbst
    return;
  }
  play(remaining, s.endAt, `Pause · ${s.label}`);
}

/**
 * Deckt die Hintergrund-Datei das Ende dieses Timers ab? Dann darf RestTimerBar nicht zusätzlich piepen.
 * Nein, wenn iOS das Abspielen blockiert oder unterbrochen hat (z. B. Anruf, Pause auf dem Sperrbildschirm).
 */
export function backgroundAlarmCovers(endAt: number): boolean {
  if (!audio || scheduledEndAt !== endAt || !started) return false;
  return audio.ended || !audio.paused;
}

/** Testlauf: Signal nach `seconds` Sekunden, zum Ausprobieren mit gesperrtem Bildschirm. */
export function testBackgroundAlarm(seconds: number): boolean {
  if (restTimer.get()) return false;
  play(seconds, Date.now() + seconds * 1000, 'Test Timer-Ton');
  return true;
}

export function installBackgroundAlarm(): void {
  restTimer.subscribe(sync);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') resync();
  });
  // Timer aus localStorage (App neu geladen): Versuch ohne Tap, klappt evtl. nicht
  sync();
}
