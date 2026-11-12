import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['reconcile-hamster-unearned.ngrok-free.dev', 'feminine-sanitary-cussed.ngrok-free.dev'],
    proxy: {
      '/auth': 'http://localhost:3001',
      '/users': 'http://localhost:3001',
      '/api': 'http://localhost:3001',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Low-RAM development PCs (with Docker running) are slow to render and click through these views; with the
    // default 5 s limit, correct tests time out. A real hang still fails, only later.
    testTimeout: 20_000,
    hookTimeout: 20_000,
    // Fewer parallel jsdom workers keep the machine from swapping, which is what made the tests slow.
    maxWorkers: 2,
  },
});
