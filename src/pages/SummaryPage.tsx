import { Header } from '../components/Header';
import { useExerciseMap, useSessions } from '../db/hooks';
import { fmtDuration, fmtInt, fmtSets } from '../lib/format';
import { navigate } from '../lib/router';
import { doneSets, exerciseHistory, sessionVolume, volume } from '../logic/history';
import { detectRecords, RECORD_LABEL, type RecordType } from '../logic/records';

export function SummaryPage({ id }: { id: string }) {
  const sessions = useSessions();
  const exercises = useExerciseMap();
  if (!sessions || !exercises) return <div className="page" />;

  const session = sessions.find((s) => s.id === id);
  if (!session) {
    return (
      <div className="page">
        <Header title="Zusammenfassung" onBack={() => navigate('training')} />
        <p className="muted center">Training nicht gefunden.</p>
      </div>
    );
  }

  const prevSameDay = sessions.find(
    (s) => s.endedAt != null && s.id !== session.id && s.dayId === session.dayId && s.startedAt < session.startedAt,
  );
  const vol = sessionVolume(session);
  const prevVol = prevSameDay ? sessionVolume(prevSameDay) : null;
  const duration = (session.endedAt ?? Date.now()) - session.startedAt;

  const rows = session.blocks.map((b) => {
    const ex = exercises.get(b.exerciseId);
    const hist = exerciseHistory(sessions, b.exerciseId, session.id, session.startedAt);
    const sets = doneSets(b.sets);
    const recs = detectRecords(hist.flatMap((h) => h.sets), sets);
    const recTypes = [...new Set(recs.flat())] as RecordType[];
    const prev = hist[0];
    return { b, ex, sets, recTypes, prev, vol: volume(sets), prevVol: prev ? volume(prev.sets) : null };
  });
  const allRecords = rows.filter((r) => r.recTypes.length);

  return (
    <div className="page">
      <Header title="Training beendet 🎉" subtitle={session.dayName} />

      <div className="stats-grid">
        <div className="stat">
          <div className="stat-value">{fmtDuration(duration)}</div>
          <div className="stat-label">Dauer</div>
        </div>
        <div className="stat">
          <div className="stat-value">{fmtInt(vol)} kg</div>
          <div className="stat-label">
            Volumen
            {prevVol != null && <Delta value={vol - prevVol} unit=" kg" />}
          </div>
        </div>
        <div className="stat">
          <div className="stat-value">{rows.reduce((n, r) => n + r.sets.length, 0)}</div>
          <div className="stat-label">Sätze</div>
        </div>
        <div className="stat">
          <div className="stat-value accent">{allRecords.length ? `🏆 ${allRecords.length}` : '–'}</div>
          <div className="stat-label">Rekorde</div>
        </div>
      </div>

      {allRecords.length > 0 && (
        <section className="card">
          <h2 className="section-title">Neue Rekorde</h2>
          {allRecords.map((r) => (
            <div key={r.b.id} className="record-item">
              <strong>🏆 {r.ex?.name ?? r.b.exerciseName}</strong>
              <span className="muted">{r.recTypes.map((t) => RECORD_LABEL[t]).join(' · ')}</span>
            </div>
          ))}
        </section>
      )}

      <section className="card">
        <h2 className="section-title">Vergleich zum letzten Mal</h2>
        {rows.map((r) => (
          <div key={r.b.id} className="compare-item">
            <div className="compare-name">{r.ex?.name ?? r.b.exerciseName}</div>
            <div className="compare-now">{fmtSets(r.sets, r.ex?.weightMode)}</div>
            <div className="compare-prev muted">
              {r.prev ? `vorher: ${fmtSets(r.prev.sets, r.ex?.weightMode)}` : 'erstes Mal'}
              {r.prevVol != null && <Delta value={r.vol - r.prevVol} unit=" kg Vol." />}
            </div>
          </div>
        ))}
      </section>

      <button className="btn accent block" onClick={() => navigate('training', true)}>
        Fertig
      </button>
    </div>
  );
}

export function Delta({ value, unit = '' }: { value: number; unit?: string }) {
  if (Math.abs(value) < 0.5) return <span className="delta"> ±0{unit}</span>;
  return (
    <span className={`delta ${value > 0 ? 'up' : 'down'}`}>
      {' '}
      {value > 0 ? '+' : '−'}
      {fmtInt(Math.abs(value))}
      {unit}
    </span>
  );
}
