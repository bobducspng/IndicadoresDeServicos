import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

/**
 * Build do painel para o Google Apps Script: gera UM arquivo HTML com todo o
 * JavaScript, CSS e imagens embutidos (dist-gas/index.gas.html), que no Apps
 * Script vira o arquivo "Index.html". Troca o cliente tRPC e a leitura da
 * planilha pelas versões que falam com o Code.gs (google.script.run).
 *
 * Uso: pnpm build:gas
 */
const raiz = import.meta.dirname;
const src = path.resolve(raiz, "client", "src");

export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: [
      { find: /^@\/lib\/trpc$/, replacement: path.resolve(src, "lib/trpc.gas.ts") },
      { find: /^@\/lib\/sheets$/, replacement: path.resolve(src, "lib/sheets.gas.ts") },
      { find: /^@shared/, replacement: path.resolve(raiz, "shared") },
      { find: /^@\//, replacement: `${src}/` },
    ],
  },
  define: {
    "import.meta.env.VITE_TARGET": JSON.stringify("gas"),
  },
  envDir: raiz,
  root: path.resolve(raiz, "client"),
  publicDir: false,
  build: {
    outDir: path.resolve(raiz, "dist-gas"),
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 100_000,
    rollupOptions: { input: path.resolve(raiz, "client", "index.gas.html") },
  },
});
