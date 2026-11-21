import { defineConfig } from 'vitest/config';

// Eigene Test-Konfiguration, damit das PWA-Plugin bei Tests nicht geladen wird.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
