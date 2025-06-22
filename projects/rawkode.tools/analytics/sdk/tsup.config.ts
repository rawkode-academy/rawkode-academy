import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  minify: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  external: [],
  platform: 'browser',
  target: 'es2020',
  esbuildOptions(options) {
    options.bundle = true;
  }
});