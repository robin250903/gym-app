import { useEffect, useRef, useState } from 'react';
import { Header } from '../components/Header';
import { requestPersistentStorage } from '../db/db';
import { importBackup, parseBackup, shareOrDownloadBackup } from '../db/backup';
import { useDays, useExercises, useRestDayNotes, useSessions } from '../db/hooks';
import { saveDay, saveExercise, setRestDayNotes } from '../db/repo';
import type { WorkoutDay } from '../db/types';
import { uid, WEEKDAYS_LONG, WEEKDAYS_SHORT, WEEK_ORDER } from '../lib/format';
import { isBackgroundSoundEnabled, setBackgroundSoundEnabled, testBackgroundAlarm } from '../lib/backgroundAlarm';
import { navigate } from '../lib/router';
import { playAlarm, unlockAudio } from '../lib/sound';
import { newExercise } from './ExerciseEditor';

export function SettingsPage() {
  const days = useDays();
  const exercises = useExercises();
  const notes = useRestDayNotes();
  const sessions = useSessions();
  const fileRef = useRef<HTMLInputElement>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [bgSound, setBgSound] = useState(isBackgroundSoundEnabled);

  useEffect(() => {
    void requestPersistentStorage().then(setPersisted);
  }, []);

  if (!days || !exercises || !notes || !sessions) return <div className="page" />;

  const move = async (d: WorkoutDay, dir: -1 | 1) => {
    const idx = days.indexOf(d);
    const other = days[idx + dir];
    if (!other) return;
    await Promise.all([saveDay({ ...d, order: other.order }), saveDay({ ...other, order: d.order })]);
  };

  const addDay = async () => {
    const name = prompt('Name des Trainingstags?')?.trim();
    if (!name) return;
    const day: WorkoutDay = {
      id: uid(),
      name,
      weekdays: [],
      slots: [],
      active: true,
      order: Math.max(-1, ...days.map((d) => d.order)) + 1,
    };
    await saveDay(day);
    navigate(`einstellungen/tag/${day.id}`);
  };

  const addExercise = async () => {
    const name = prompt('Name der Übung?')?.trim();
    if (!name) return;
    const ex = newExercise(name);
    await saveExercise(ex);
    navigate(`einstellungen/uebung/${ex.id}`);
  };

  const doExport = async () => {
    const res = await shareOrDownloadBackup();
    if (res === 'shared') setMessage('Backup geteilt ✓');
    else if (res === 'downloaded') setMessage('Backup heruntergeladen ✓');
  };

  const doImport = async (file: File) => {
    try {
      const backup = parseBackup(await file.text());
      const ok = confirm(
        `Backup vom ${new Date(backup.exportedAt).toLocaleString('de-DE')} mit ${backup.sessions.length} Trainings importieren?\n\nAlle aktuellen Daten auf diesem Gerät werden dabei ERSETZT.`,
      );
      if (!ok) return;
      await importBackup(backup);
      setMessage(`Import erfolgreich: ${backup.sessions.length} Trainings, ${backup.exercises.length} Übungen ✓`);
    } catch (e) {
      alert(`Import fehlgeschlagen: ${(e as Error).message}`);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const finished = sessions.filter((s) => s.endedAt != null).length;

  return (
    <div className="page">
      <Header title="Einstellungen" />

      <section className="card">
        <h2 className="section-title">Trainingstage</h2>
        {days.map((d, i) => (
          <div key={d.id} className="row-item">
            <button className="row-main" onClick={() => navigate(`einstellungen/tag/${d.id}`)}>
              <span className="row-title">
                {d.name} {!d.active && <span className="badge">pausiert</span>}
              </span>
              <span className="muted">
                {d.weekdays.length
                  ? WEEK_ORDER.filter((w) => d.weekdays.includes(w)).map((w) => WEEKDAYS_SHORT[w]).join(', ')
                  : 'kein Wochentag'}{' '}
                · {d.slots.length} Übungen
              </span>
            </button>
            <button className="btn-icon" disabled={i === 0} onClick={() => move(d, -1)} aria-label="Nach oben">
              ↑
            </button>
            <button className="btn-icon" disabled={i === days.length - 1} onClick={() => move(d, 1)} aria-label="Nach unten">
              ↓
            </button>
          </div>
        ))}
        <button className="btn ghost block" onClick={addDay}>
          + Trainingstag
        </button>
      </section>

      <section className="card">
        <h2 className="section-title">Übungen ({exercises.length})</h2>
        {exercises.map((e) => (
          <button key={e.id} className="row-main standalone" onClick={() => navigate(`einstellungen/uebung/${e.id}`)}>
            <span className="row-title">{e.name}</span>
            <span className="muted">
              {e.repMin}–{e.repMax} Wdh · {e.restSec} s ·{' '}
              {e.weightMode.kind === 'liste' ? 'Gewichtsliste' : e.weightMode.kind === 'koerpergewicht' ? 'Körpergewicht' : `Schritt ${String(e.weightMode.step).replace('.', ',')} kg`}
            </span>
          </button>
        ))}
        <button className="btn ghost block" onClick={addExercise}>
          + Übung
        </button>
      </section>

      <section className="card">
        <h2 className="section-title">Hinweis an Tagen ohne Training</h2>
        <p className="muted small">Wird angezeigt, wenn heute kein aktiver Trainingstag geplant ist.</p>
        {WEEK_ORDER.map((w) => (
          <label key={w} className="field inline">
            <span className="field-label">{WEEKDAYS_LONG[w]}</span>
            <input
              type="text"
              defaultValue={notes[String(w)] ?? ''}
              placeholder="z. B. Fußball ⚽"
              onBlur={(e) => {
                const value = e.target.value.trim();
                if ((notes[String(w)] ?? '') === value) return;
                const next = { ...notes };
                if (value) next[String(w)] = value;
                else delete next[String(w)];
                void setRestDayNotes(next);
              }}
            />
          </label>
        ))}
      </section>

      <section className="card">
        <h2 className="section-title">Backup</h2>
        <p className="muted small">
          Alle Daten liegen nur auf diesem iPhone. Exportiere regelmäßig ein Backup (z. B. „In Dateien sichern“ → iCloud
          Drive). {finished} Trainings gespeichert.
        </p>
        <button className="btn accent block" onClick={doExport}>
          Backup exportieren (JSON)
        </button>
        <button className="btn block" onClick={() => fileRef.current?.click()}>
          Backup importieren …
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void doImport(f);
          }}
        />
        {message && <p className="success">{message}</p>}
      </section>

      <section className="card">
        <h2 className="section-title">App</h2>
        <div className="pr-row">
          <span>Dauerhafter Speicher</span>
          <strong>{persisted == null ? 'unbekannt' : persisted ? 'aktiv ✓' : 'nicht gewährt'}</strong>
        </div>
        <button
          className="btn block"
          onClick={() => {
            unlockAudio();
            playAlarm();
          }}
        >
          Timer-Ton testen 🔔
        </button>
        <p className="muted small">Ist das iPhone stumm geschaltet, bleibt der Ton aus – das Timer-Ende blinkt dann nur.</p>
        <label className="toggle">
          <input
            type="checkbox"
            checked={bgSound}
            onChange={(e) => {
              setBgSound(e.target.checked);
              setBackgroundSoundEnabled(e.target.checked);
            }}
          />
          Ton auch im Hintergrund
        </label>
        <p className="muted small">
          Während der Pause läuft eine stille Audiospur. So kommt der Ton auch, wenn du in einer anderen App bist oder
          der Bildschirm gesperrt ist (meist auch bei stumm geschaltetem iPhone). Nachteil: iOS pausiert dabei Musik aus
          anderen Apps wie Spotify.
        </p>
        {bgSound && (
          <button
            className="btn block"
            onClick={() => {
              if (!testBackgroundAlarm(10)) alert('Es läuft gerade ein Pausentimer.');
            }}
          >
            Hintergrund testen: Ton in 10 s 🔒
          </button>
        )}
        <p className="muted small">Version {__APP_VERSION__}</p>
      </section>
    </div>
  );
}
