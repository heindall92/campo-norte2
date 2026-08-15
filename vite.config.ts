import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { aiDevProxyPlugin } from "./vite-ai-proxy.ts";

export default defineConfig({
  plugins: [react(), tailwindcss(), aiDevProxyPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      // Legacy path still used if something hits /api/ollama/*
      "/api/ollama": {
        target: "https://ollama.com",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/ollama/, "/api"),
      },
    },
  },
});
