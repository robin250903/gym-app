import { useState } from 'react';
import { Header } from '../components/Header';
import { useDays, useExerciseMap, useRestDayNotes, useSessions } from '../db/hooks';
import { saveSession } from '../db/repo';
import type { WorkoutDay } from '../db/types';
import { fmtDate, fmtDuration, WEEKDAYS_LONG, WEEKDAYS_SHORT, WEEK_ORDER } from '../lib/format';
import { navigate } from '../lib/router';
import { createSession, todaysDays } from '../logic/plan';
import { unlockAudio } from '../lib/sound';

export function TrainingHome() {
  const days = useDays();
  const sessions = useSessions();
  const exercises = useExerciseMap();
  const notes = useRestDayNotes();
  const [showPaused, setShowPaused] = useState(false);

  if (!days || !sessions || !exercises || !notes) return <div className="page" />;

  const weekday = new Date().getDay();
  const running = sessions.find((s) => s.endedAt == null);
  const today = todaysDays(days, weekday);
  const others = days
    .filter((d) => d.active && !today.includes(d))
    .sort((a, b) => nextOccurrence(a, weekday) - nextOccurrence(b, weekday));
  const paused = days.filter((d) => !d.active);
  const lastByDay = (dayId: string) => sessions.find((s) => s.dayId === dayId && s.endedAt != null);

  const start = async (day: WorkoutDay) => {
    unlockAudio();
    if (running && !confirm(`Es läuft noch „${running.dayName}“. Trotzdem ein neues Training starten?`)) return;
    const session = createSession(day, exercises, sessions);
    await saveSession(session);
    navigate(`training/${session.id}`);
  };

  const card = (d: WorkoutDay, highlight = false) => {
    const last = lastByDay(d.id);
    return (
      <button key={d.id} className={`day-card ${highlight ? 'today' : ''} ${d.active ? '' : 'paused'}`} onClick={() => start(d)}>
        <div className="day-card-top">
          <span className="day-name">{d.name}</span>
          <span className="day-weekdays">{d.weekdays.length ? sortWeekdays(d.weekdays).map((w) => WEEKDAYS_SHORT[w]).join(' · ') : '–'}</span>
        </div>
        <div className="day-card-meta">
          {d.slots.length} Übungen
          {last ? ` · zuletzt ${fmtDate(last.startedAt)}` : ' · noch nie trainiert'}
          {!d.active && ' · pausiert'}
        </div>
        {highlight && <div className="day-card-cta">Training starten ›</div>}
      </button>
    );
  };

  return (
    <div className="page">
      <Header title="Training" subtitle={`${WEEKDAYS_LONG[weekday]}, ${new Date().toLocaleDateString('de-DE')}`} />

      {running && (
        <button className="resume-card" onClick={() => navigate(`training/${running.id}`)}>
          <div className="resume-title">Training fortsetzen</div>
          <div className="resume-meta">
            {running.dayName} · seit {fmtDuration(Date.now() - running.startedAt)} ·{' '}
            {running.blocks.reduce((n, b) => n + b.sets.filter((s) => s.done).length, 0)} erledigt
          </div>
        </button>
      )}

      {today.length > 0 ? (
        <section>
          <h2 className="section-title">Heute dran</h2>
          {today.map((d) => card(d, true))}
        </section>
      ) : (
        <div className="rest-day">Heute {notes[String(weekday)]?.trim() || 'kein Training geplant'}</div>
      )}

      {others.length > 0 && (
        <section>
          <h2 className="section-title">{today.length ? 'Andere Tage' : 'Trotzdem trainieren'}</h2>
          {others.map((d) => card(d))}
        </section>
      )}

      {paused.length > 0 && (
        <section>
          <button className="section-toggle" onClick={() => setShowPaused((v) => !v)}>
            {showPaused ? '▾' : '▸'} Pausiert ({paused.length})
          </button>
          {showPaused && paused.map((d) => card(d))}
        </section>
      )}

      {days.length === 0 && <p className="muted center">Noch keine Trainingstage. Lege sie in den Einstellungen an.</p>}
    </div>
  );
}

function sortWeekdays(w: number[]) {
  return [...w].sort((a, b) => WEEK_ORDER.indexOf(a) - WEEK_ORDER.indexOf(b));
}

/** Tage bis zum nächsten geplanten Termin (für die Sortierung) */
function nextOccurrence(d: WorkoutDay, today: number): number {
  if (!d.weekdays.length) return 99;
  return Math.min(...d.weekdays.map((w) => (w - today + 7) % 7 || 7));
}
