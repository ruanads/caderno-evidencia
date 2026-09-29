import { defineConfig, devices } from '@playwright/test';

// Os testes abrem o dist/index.html direto do disco (file://), do mesmo jeito
// que a ferramenta e usada: sem servidor. Rode "npm run build" antes
// ("npm run test:e2e" ja faz isso).
export default defineConfig({
  testDir: 'tests/e2e',
  retries: 0,
  reporter: [['list']],
  use: { ...devices['Desktop Chrome'], viewport: { width: 1360, height: 900 }, acceptDownloads: true },
  projects: [{ name: 'chromium', grepInvert: /@docs/ }, { name: 'docs', grep: /@docs/ }],
});
