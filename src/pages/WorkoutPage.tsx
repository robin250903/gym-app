import { useCallback, useEffect, useMemo, useState } from 'react';
import { BlockCard } from '../components/BlockCard';
import { Header } from '../components/Header';
import { RestTimerBar } from '../components/RestTimerBar';
import { db } from '../db/db';
import { useDays, useExerciseMap, useSessions } from '../db/hooks';
import { deleteSession, finishSession, saveSession } from '../db/repo';
import type { Exercise, Session, SessionBlock } from '../db/types';
import { fmtDuration } from '../lib/format';
import { restTimer } from '../lib/restTimer';
import { navigate } from '../lib/router';
import { useWakeLock } from '../lib/useWakeLock';
import { exerciseHistory } from '../logic/history';
import { buildBlock } from '../logic/plan';

export function WorkoutPage({ id }: { id: string }) {
  const sessions = useSessions();
  const exercises = useExerciseMap();
  const days = useDays();
  // Lokaler Zustand ist die Quelle der Wahrheit; jede Änderung wird sofort gespeichert.
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [, forceTick] = useState(0);

  useEffect(() => {
    let alive = true;
    void db.sessions.get(id).then((s) => alive && setSession(s ?? null));
    return () => {
      alive = false;
    };
  }, [id]);

  // Dauer im Header aktualisieren
  useEffect(() => {
    const t = window.setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => window.clearInterval(t);
  }, []);

  useWakeLock(!!session && session.endedAt == null);

  const update = useCallback((fn: (s: Session) => Session) => {
    setSession((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      void saveSession(next);
      return next;
    });
  }, []);

  const updateBlock = useCallback(
    (blockId: string, fn: (b: SessionBlock) => SessionBlock) =>
      update((s) => ({ ...s, blocks: s.blocks.map((b) => (b.id === blockId ? fn(b) : b)) })),
    [update],
  );

  const histories = useMemo(() => {
    const map = new Map<string, ReturnType<typeof exerciseHistory>>();
    if (!session || !sessions) return map;
    for (const b of session.blocks) {
      if (!map.has(b.exerciseId)) map.set(b.exerciseId, exerciseHistory(sessions, b.exerciseId, session.id));
    }
    return map;
  }, [session, sessions]);

  // Bereits beendetes Training → Verlaufsansicht
  useEffect(() => {
    if (session && session.endedAt != null) navigate(`verlauf/${session.id}`, true);
  }, [session]);

  if (session === undefined || !sessions || !exercises || !days) return <div className="page" />;
  if (session === null) {
    return (
      <div className="page">
        <Header title="Training" onBack={() => navigate('training')} />
        <p className="muted center">Dieses Training gibt es nicht mehr.</p>
      </div>
    );
  }
  if (session.endedAt != null) return null; // Weiterleitung siehe useEffect

  const day = days.find((d) => d.id === session.dayId);
  const openSets = session.blocks.reduce((n, b) => n + b.sets.filter((s) => !s.done).length, 0);
  const doneSets = session.blocks.reduce((n, b) => n + b.sets.filter((s) => s.done).length, 0);

  const switchVariant = (block: SessionBlock, exerciseId: string) => {
    const ex = exercises.get(exerciseId);
    if (!ex) return;
    if (block.sets.some((s) => s.done) && !confirm('Erledigte Sätze dieser Übung werden verworfen. Variante wechseln?')) return;
    const slot = day?.slots.find((s) => s.id === block.slotId) ?? null;
    const fresh = buildBlock(slot ?? { id: block.slotId ?? '', category: block.category, sets: block.plannedSets }, ex, sessions, session.id, block.plannedSets);
    updateBlock(block.id, () => ({ ...fresh, id: block.id, slotId: block.slotId, category: block.category }));
  };

  const onSetDone = (ex: Exercise) => restTimer.start(ex.restSec, ex.name);

  const finish = async () => {
    if (doneSets === 0) {
      if (confirm('Noch kein Satz erledigt. Training verwerfen?')) await discard(true);
      return;
    }
    const msg =
      openSets > 0
        ? `Training beenden? ${openSets} nicht abgehakte${openSets === 1 ? 'r Satz wird' : ' Sätze werden'} nicht gespeichert.`
        : 'Training beenden?';
    if (!confirm(msg)) return;
    restTimer.stop();
    const finished = await finishSession(session);
    navigate(`zusammenfassung/${finished.id}`, true);
  };

  const discard = async (skipConfirm = false) => {
    if (!skipConfirm && !confirm('Training verwerfen? Alle Eingaben dieses Trainings gehen verloren.')) return;
    restTimer.stop();
    await deleteSession(session.id);
    navigate('training', true);
  };

  return (
    <div className="page workout-page">
      <Header
        title={session.dayName}
        subtitle={`${fmtDuration(Date.now() - session.startedAt)} · ${doneSets} ${doneSets === 1 ? 'Satz' : 'Sätze'} erledigt`}
        onBack={() => navigate('training')}
        right={
          <button className="btn small accent" onClick={finish}>
            Beenden
          </button>
        }
      />

      {session.blocks.map((b) => {
        const slot = day?.slots.find((s) => s.id === b.slotId);
        const variants = (slot?.variantIds ?? [b.exerciseId]).map((v) => exercises.get(v)).filter((e): e is Exercise => !!e);
        return (
          <BlockCard
            key={b.id}
            block={b}
            exercise={exercises.get(b.exerciseId)}
            variants={variants}
            history={histories.get(b.exerciseId) ?? []}
            onUpdate={(fn) => updateBlock(b.id, fn)}
            onSwitchVariant={(exId) => switchVariant(b, exId)}
            onSetDone={onSetDone}
          />
        );
      })}

      <div className="workout-footer">
        <button className="btn accent block" onClick={finish}>
          Training beenden
        </button>
        <button className="btn danger-ghost block" onClick={() => discard()}>
          Training verwerfen
        </button>
      </div>

      <RestTimerBar />
    </div>
  );
}
