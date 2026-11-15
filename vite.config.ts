import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Vitest empties CSS by default; theme.test.ts reads the real tokens.
    css: { include: [/theme\.css/] },
  },
});
