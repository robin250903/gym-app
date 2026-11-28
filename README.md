# Gym-App

Trainings-Tracker fürs Fitnessstudio als **PWA** fürs iPhone. Alle Daten bleiben lokal auf dem Gerät
(IndexedDB). Es gibt kein Backend, keinen Login und keinen Sync, und die App funktioniert komplett offline.

**Stack:** Vite · React · TypeScript · Dexie (IndexedDB) · vite-plugin-pwa (Service Worker) · Vitest.
Die Diagramme sind ein kleines eigenes SVG-Bauteil statt Recharts. Für drei einfache Liniendiagramme
spart das rund 100 KB JavaScript.

## Lokal starten

Voraussetzung: [Node.js](https://nodejs.org) 22 oder neuer.

```powershell
npm install
npm run dev        # http://localhost:5173/gym-app/
npm test           # Unit-Tests (Progression, 1RM, Rekorde)
npm run build      # Produktions-Build nach dist/
npm run preview    # Build lokal ansehen (inkl. Service Worker)
```

Die App-Icons werden mit `npm run icons` aus `scripts/generate-icons.mjs` erzeugt.

## Deployen (GitHub Pages)

Jeder Push auf `main` baut die App, führt die Tests aus und veröffentlicht sie über
`.github/workflows/deploy.yml` auf GitHub Pages:

**https://robin250903.github.io/gym-app/**

Einmalig eingerichtet: Unter **Settings → Pages → Build and deployment → Source** ist **„GitHub Actions“**
gewählt. Den Workflow kann man unter **Actions** auch manuell starten.

> Das Repo ist öffentlich, damit Pages ohne GitHub Pro funktioniert. Deine Trainingsdaten sind davon nicht
> betroffen, weil sie nur auf dem iPhone liegen. Öffentlich sind nur der Code und der Seed-Trainingsplan.

Alternative: **Vercel**. Projekt importieren, Build-Befehl `npm run build`, Output `dist`. Dafür muss in
`vite.config.ts` die Konstante `BASE` auf `'/'` stehen.

## Aufs iPhone installieren

1. Die URL oben in **Safari** öffnen. Andere Browser können auf iOS keine Web-Apps installieren.
2. **Teilen-Button** antippen, dann **„Zum Home-Bildschirm“** und **„Hinzufügen“**.
3. Die App einmal vom Home-Bildschirm öffnen, solange du Internet hast. Danach ist alles offline verfügbar.

Updates: Wenn eine neue Version deployt ist, holt sich die App sie beim nächsten Öffnen mit Internet automatisch.
Manchmal braucht es zweimal Öffnen.

Hinweise:
- **Ton im Hintergrund** (Einstellungen → App, standardmäßig an): Während der Pause läuft eine stille Audiospur,
  die am Ende piept. So kommt der Ton auch, wenn du in einer anderen App bist oder das iPhone gesperrt ist.
  Auf dem Sperrbildschirm steht dann „Pause · Übung“. Nachteil: iOS pausiert währenddessen Musik aus anderen
  Apps. Mit „Hintergrund testen“ kannst du es ausprobieren: tippen, iPhone sperren, nach 10 s piept es.
- Ist der Hintergrund-Ton aus, kommt der Ton nur bei geöffneter App und nicht stumm geschaltetem iPhone, dafür
  läuft Musik aus anderen Apps weiter. Das optische Signal (blinkende Leiste) gibt es immer.
- Der Bildschirm bleibt während eines laufenden Trainings an (Screen Wake Lock, ab iOS 18.4 in Home-Screen-Apps).

## Backup

Alle Daten liegen **nur auf dem iPhone**. Wird die App gelöscht, sind die Daten weg. Darum regelmäßig sichern:

- **Exportieren:** Einstellungen → **Backup exportieren**, dann im Teilen-Dialog z. B. **„In Dateien sichern“**
  (iCloud Drive) wählen.
- **Importieren:** Einstellungen → **Backup importieren …** und die JSON-Datei auswählen. Dabei werden **alle
  aktuellen Daten ersetzt**.

Die App bittet iOS beim Start außerdem, den Speicher dauerhaft zu behalten (`navigator.storage.persist()`).
Unter Einstellungen → App siehst du den Status.

## Projektstruktur

```
src/
  db/          Datenmodell (types.ts), Dexie-DB, Seed-Daten, Schreibzugriffe (repo.ts), Backup, Live-Hooks
  logic/       Reine Logik ohne UI: progression.ts (doppelte Progression), records.ts (1RM, Rekorde),
               history.ts (Verlauf, Statistik), plan.ts (Training anlegen), weights.ts (Gewichtsschritte)
  lib/         Formatierung, Pausentimer (Timestamp-basiert), Ton (auch im Hintergrund), Wake Lock, Hash-Router
  components/  Wiederverwendbare UI-Bausteine (Übungskarte, Timer-Leiste, Zahlenfeld, Diagramm …)
  pages/       Screens: Training, Trainingsansicht, Zusammenfassung, Verlauf, Fortschritt, Einstellungen
```

### Progressionslogik (kurz)

- Solange nicht **alle** Arbeitssätze das obere Ende des Wdh-Bereichs erreichen, bleibt das Gewicht gleich
  und das Ziel ist +1 Wdh.
- Wenn alle Sätze oben sind, kommt das nächste Gewicht (Schritt bzw. nächster Wert der Liste) mit dem
  unteren Ende als Ziel.
- Bei einem Sprung von **mehr als 10 %** (z. B. Kurzhantel 10 → 12,5 kg) gibt es gemischte Sätze. Pro
  Training kommt ein Satz mit dem neuen Gewicht dazu, sobald das untere Ende geschafft ist.
- „Gewicht beibehalten“ übernimmt das alte Gewicht. Alle Werte bleiben frei änderbar.
- Wird das untere Ende zweimal hintereinander **deutlich** verfehlt (ein Satz 2+ Wdh darunter), erscheint der
  Hinweis „Gewicht evtl. etwas zu hoch?“. Das Gewicht wird dabei nicht automatisch reduziert.
