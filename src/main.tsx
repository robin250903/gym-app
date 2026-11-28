import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { installBackgroundAlarm } from './lib/backgroundAlarm';
import { requestPersistentStorage } from './db/db';
import { ensureSeeded } from './db/seed';
import { installAudioUnlock } from './lib/sound';
import './styles.css';

installAudioUnlock();
installBackgroundAlarm();
void requestPersistentStorage();

ensureSeeded()
  .catch((e) => console.error('Seed fehlgeschlagen', e))
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
