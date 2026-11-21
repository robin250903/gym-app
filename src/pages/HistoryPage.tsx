import { Header } from '../components/Header';
import { useSessions } from '../db/hooks';
import { fmtDate, fmtDuration, fmtInt, fmtTime } from '../lib/format';
import { navigate } from '../lib/router';
import { sessionVolume } from '../logic/history';

export function HistoryPage() {
  const sessions = useSessions();
  if (!sessions) return <div className="page" />;
  const finished = sessions.filter((s) => s.endedAt != null);

  return (
    <div className="page">
      <Header title="Verlauf" subtitle={`${finished.length} Trainings`} />
      {finished.length === 0 && <p className="muted center">Noch keine abgeschlossenen Trainings.</p>}
      {finished.map((s) => {
        const sets = s.blocks.reduce((n, b) => n + b.sets.length, 0);
        return (
          <button key={s.id} className="list-item" onClick={() => navigate(`verlauf/${s.id}`)}>
            <div className="list-main">
              <div className="list-title">{s.dayName}</div>
              <div className="list-sub">
                {fmtDate(s.startedAt)} · {fmtTime(s.startedAt)} · {fmtDuration((s.endedAt ?? s.startedAt) - s.startedAt)}
              </div>
            </div>
            <div className="list-side">
              <div>{sets} Sätze</div>
              <div className="muted">{fmtInt(sessionVolume(s))} kg</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
