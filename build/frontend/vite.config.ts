import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    server: {
      host: "::",
      port: 5800,
      hmr: {
        overlay: false,
      },
    },
  plugins: [react()],
  test: {
    environment: 'node',
  },
});
