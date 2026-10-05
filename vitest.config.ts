import path from 'node:path';
import { defineConfig } from 'vitest/config';

const frontendModules = path.resolve(__dirname, 'frontend/node_modules');

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'frontend'),
      react: path.resolve(frontendModules, 'react'),
      'react-dom': path.resolve(frontendModules, 'react-dom'),
      'react-dom/server': path.resolve(frontendModules, 'react-dom/server.node.js'),
      clsx: path.resolve(frontendModules, 'clsx'),
      'tailwind-merge': path.resolve(frontendModules, 'tailwind-merge'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts', 'test/**/*.test.ts', 'prisma/**/*.spec.ts', 'frontend/lib/**/*.spec.ts', 'frontend/components/**/*.spec.ts'],
  },
});
