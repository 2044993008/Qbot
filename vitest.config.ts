import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['node_modules', '.next', 'dist', 'e2e'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '.next/',
        'e2e/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/types.ts',
        'src/components/ui/**',
        'src/app/**/page.tsx',
        'src/app/**/layout.tsx',
      ],
      thresholds: {
        lines: 55,
        functions: 55,
        branches: 45,
        statements: 55,
      },
    },
    deps: {
      optimizer: {
        web: {
          include: ['@testing-library/react', '@testing-library/jest-dom'],
        },
      },
    },
    // 增加超时，API集成测试可能需要较长时间
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
