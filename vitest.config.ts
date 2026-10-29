import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['tests/components/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/components/setup.ts'],
    maxWorkers: 1,
  },
});
