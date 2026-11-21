import { db } from './db';
import type { BackupFile } from './types';

export async function exportBackup(): Promise<BackupFile> {
  const [exercises, days, sessions, meta] = await Promise.all([
    db.exercises.toArray(),
    db.days.toArray(),
    db.sessions.toArray(),
    db.meta.toArray(),
  ]);
  return { app: 'gym-app', version: 1, exportedAt: new Date().toISOString(), exercises, days, sessions, meta };
}

export function backupFileName(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `gym-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
}

/**
 * Teilt die Backup-Datei über den iOS-Teilen-Dialog (z. B. „In Dateien sichern“).
 * Fällt auf einen normalen Download zurück, wenn Teilen nicht geht.
 */
export async function shareOrDownloadBackup(): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const data = await exportBackup();
  const name = backupFileName();
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return 'shared';
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'cancelled';
      // sonst Download versuchen
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}

export function parseBackup(text: string): BackupFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Die Datei ist kein gültiges JSON.');
  }
  const b = data as Partial<BackupFile>;
  if (b?.app !== 'gym-app' || !Array.isArray(b.exercises) || !Array.isArray(b.days) || !Array.isArray(b.sessions)) {
    throw new Error('Das ist keine Backup-Datei dieser App.');
  }
  if (b.version !== 1) throw new Error(`Unbekannte Backup-Version: ${String(b.version)}`);
  return { ...b, meta: Array.isArray(b.meta) ? b.meta : [] } as BackupFile;
}

/** Ersetzt ALLE Daten durch den Inhalt des Backups. */
export async function importBackup(b: BackupFile): Promise<void> {
  await db.transaction('rw', db.exercises, db.days, db.sessions, db.meta, async () => {
    await Promise.all([db.exercises.clear(), db.days.clear(), db.sessions.clear(), db.meta.clear()]);
    await db.exercises.bulkPut(b.exercises);
    await db.days.bulkPut(b.days);
    await db.sessions.bulkPut(b.sessions);
    await db.meta.bulkPut(b.meta);
    await db.meta.put({ key: 'seeded', value: true });
  });
}
