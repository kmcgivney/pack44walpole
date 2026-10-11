import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  base: './',
  server: {
    fs: {
      deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/newsletter_archive/**'],
    },
    watch: {
      ignored: ['**/newsletter_archive/**'],
    },
  },
  build: {
    rollupOptions: {
      input: {
        home: resolve(projectRoot, 'index.html'),
        signups: resolve(projectRoot, 'signups/index.html'),
        newsletters: resolve(projectRoot, 'newsletters/index.html'),
      },
    },
  },
});