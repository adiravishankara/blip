import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const rootDir = dirname(fileURLToPath(import.meta.url));

function copyManifestPlugin() {
  return {
    name: 'copy-extension-manifest',
    closeBundle() {
      const sourcePath = resolve(rootDir, 'src/manifest.json');
      const outputPath = resolve(rootDir, 'dist/manifest.json');
      mkdirSync(dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, readFileSync(sourcePath, 'utf8'));
    },
  };
}

export default defineConfig({
  plugins: [copyManifestPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: 'src/background.ts',
        content: 'src/content.ts',
        options: 'src/options.html',
        sidepanel: 'src/sidepanel.html',
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
