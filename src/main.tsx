import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { requestPersistentStorage } from './db/db';
import { ensureSeeded } from './db/seed';
import { installAudioUnlock } from './lib/sound';
import './styles.css';

installAudioUnlock();
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
