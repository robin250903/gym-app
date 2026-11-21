import { useMemo } from 'react';
import { Header } from '../components/Header';
import { LineChart } from '../components/LineChart';
import { useExercises, useSessions } from '../db/hooks';
import { fmtDate, fmtInt, fmtNum, fmtWeight } from '../lib/format';
import { navigate } from '../lib/router';
import { exerciseHistory, personalRecords, progressPoints } from '../logic/history';

export function ProgressPage({ exerciseId }: { exerciseId?: string }) {
  const exercises = useExercises();
  const sessions = useSessions();

  const withData = useMemo(() => {
    if (!exercises || !sessions) return [];
    return exercises
      .map((e) => ({ e, hist: exerciseHistory(sessions, e.id) }))
      .filter((x) => x.hist.length > 0)
      .sort((a, b) => b.hist[0].session.startedAt - a.hist[0].session.startedAt);
  }, [exercises, sessions]);

  if (!exercises || !sessions) return <div className="page" />;

  const selectedId = exerciseId ?? withData[0]?.e.id;
  const selected = exercises.find((e) => e.id === selectedId);
  const hist = selected ? exerciseHistory(sessions, selected.id) : [];
  const pts = progressPoints(hist);
  const pr = personalRecords(hist);
  const mode = selected?.weightMode;
  const kg = (v: number) => `${fmtNum(Math.round(v * 10) / 10)} kg`;

  return (
    <div className="page">
      <Header title="Fortschritt" />

      <label className="field">
        <span className="field-label">Übung</span>
        <select value={selectedId ?? ''} onChange={(e) => navigate(`fortschritt/${e.target.value}`, true)}>
          {withData.length > 0 && (
            <optgroup label="Mit Trainingsdaten">
              {withData.map(({ e }) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label="Alle Übungen">
            {exercises
              .filter((e) => !withData.some((w) => w.e.id === e.id))
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
          </optgroup>
        </select>
      </label>

      {selected && (
        <>
          <LineChart title="Bestes Gewicht" points={pts.map((p) => ({ x: p.at, y: p.bestWeight }))} format={kg} />
          <LineChart title="Geschätztes 1RM (Epley)" points={pts.map((p) => ({ x: p.at, y: p.best1RM }))} format={kg} />
          <LineChart title="Volumen" points={pts.map((p) => ({ x: p.at, y: p.volume }))} format={(v) => `${fmtInt(v)} kg`} />

          <section className="card">
            <h2 className="section-title">Persönliche Rekorde</h2>
            {!pr.maxWeight && <p className="muted">Noch keine Daten.</p>}
            {pr.maxWeight && (
              <div className="pr-row">
                <span>Höchstes Gewicht</span>
                <strong>
                  {fmtWeight(pr.maxWeight.weight, mode)} × {pr.maxWeight.reps}
                </strong>
                <span className="muted">{fmtDate(pr.maxWeight.at)}</span>
              </div>
            )}
            {pr.best1RM && (
              <div className="pr-row">
                <span>Bestes 1RM</span>
                <strong>{kg(pr.best1RM.value)}</strong>
                <span className="muted">
                  {fmtWeight(pr.best1RM.weight, mode)} × {pr.best1RM.reps} · {fmtDate(pr.best1RM.at)}
                </span>
              </div>
            )}
            {pr.repsAtWeight.length > 0 && (
              <>
                <h3 className="sub-title">Meiste Wdh pro Gewicht</h3>
                {pr.repsAtWeight.map((r) => (
                  <div key={r.weight} className="pr-row compact">
                    <span>{fmtWeight(r.weight, mode)}</span>
                    <strong>{r.reps} Wdh</strong>
                    <span className="muted">{fmtDate(r.at)}</span>
                  </div>
                ))}
              </>
            )}
          </section>
        </>
      )}

      {withData.length > 0 && (
        <section className="card">
          <h2 className="section-title">Rekorde aller Übungen</h2>
          {withData.map(({ e, hist: h }) => {
            const p = personalRecords(h);
            return (
              <button key={e.id} className={`pr-overview ${e.id === selectedId ? 'active' : ''}`} onClick={() => navigate(`fortschritt/${e.id}`, true)}>
                <span className="pr-name">{e.name}</span>
                <span className="muted">
                  {p.maxWeight ? `${fmtWeight(p.maxWeight.weight, e.weightMode)} × ${p.maxWeight.reps}` : '–'}
                  {p.best1RM ? ` · 1RM ${kg(p.best1RM.value)}` : ''}
                </span>
              </button>
            );
          })}
        </section>
      )}
    </div>
  );
}
