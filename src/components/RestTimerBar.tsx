import { useEffect, useState } from 'react';
import { fmtClock } from '../lib/format';
import { remainingSec, restTimer, useRestTimer } from '../lib/restTimer';
import { playAlarm } from '../lib/sound';

/** Fixierte Leiste unten mit dem Pausentimer. */
export function RestTimerBar() {
  const timer = useRestTimer();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!timer) return;
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, 250);
    // nach Rückkehr aus dem Hintergrund sofort neu berechnen
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [timer]);

  const remaining = timer ? remainingSec(timer, now) : 0;
  const finished = !!timer && remaining <= 0;

  useEffect(() => {
    if (!timer || !finished || timer.alerted) return;
    if (document.visibilityState !== 'visible') return;
    // Ton nur, wenn das Ende nicht schon lange her ist (z. B. App war im Hintergrund)
    if (now - timer.endAt < 60_000) playAlarm();
    restTimer.markAlerted();
  }, [finished, timer, now]);

  if (!timer) return null;

  const progress = Math.min(1, Math.max(0, 1 - remaining / timer.durationSec));

  return (
    <>
      {finished && <div className="flash-overlay" key={timer.endAt} aria-hidden />}
      <div className={`rest-bar ${finished ? 'finished' : ''}`} role="timer" aria-live="polite">
        <div className="rest-progress" style={{ transform: `scaleX(${progress})` }} />
        <div className="rest-content">
          <div className="rest-info">
            <div className="rest-time">{finished ? 'Pause vorbei!' : fmtClock(remaining)}</div>
            <div className="rest-label">{finished ? 'Nächster Satz 💪' : `Pause · ${timer.label}`}</div>
          </div>
          {finished ? (
            <button className="btn rest-btn wide" onClick={() => restTimer.stop()}>
              OK
            </button>
          ) : (
            <div className="rest-actions">
              <button className="btn rest-btn" onClick={() => restTimer.adjust(-15)}>
                −15 s
              </button>
              <button className="btn rest-btn" onClick={() => restTimer.adjust(30)}>
                +30 s
              </button>
              <button className="btn rest-btn" onClick={() => restTimer.stop()}>
                Überspringen
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
