import type { ReactNode } from 'react';
import { TabBar } from './components/TabBar';
import { useRoute } from './lib/router';
import { DayEditor } from './pages/DayEditor';
import { ExerciseEditor } from './pages/ExerciseEditor';
import { HistoryPage } from './pages/HistoryPage';
import { ProgressPage } from './pages/ProgressPage';
import { SessionDetailPage } from './pages/SessionDetailPage';
import { SettingsPage } from './pages/SettingsPage';
import { SummaryPage } from './pages/SummaryPage';
import { TrainingHome } from './pages/TrainingHome';
import { WorkoutPage } from './pages/WorkoutPage';

export function App() {
  const [section = 'training', a, b] = useRoute();

  let page: ReactNode;
  let tab = section;
  let showTabs = true;

  switch (section) {
    case 'training':
      if (a) {
        page = <WorkoutPage key={a} id={a} />;
        showTabs = false;
      } else page = <TrainingHome />;
      break;
    case 'zusammenfassung':
      page = <SummaryPage id={a} />;
      tab = 'training';
      break;
    case 'verlauf':
      page = a ? <SessionDetailPage key={a} id={a} /> : <HistoryPage />;
      break;
    case 'fortschritt':
      page = <ProgressPage exerciseId={a} />;
      break;
    case 'einstellungen':
      if (a === 'tag' && b) page = <DayEditor key={b} id={b} />;
      else if (a === 'uebung' && b) page = <ExerciseEditor key={b} id={b} />;
      else page = <SettingsPage />;
      break;
    default:
      page = <TrainingHome />;
      tab = 'training';
  }

  return (
    <div className={`app ${showTabs ? 'with-tabs' : ''}`}>
      <main>{page}</main>
      {showTabs && <TabBar active={tab} />}
    </div>
  );
}
