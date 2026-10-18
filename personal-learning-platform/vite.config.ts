import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist/client", chunkSizeWarningLimit: 1200 },
  server: {
    host: "127.0.0.1",
    proxy: {
      "/api": "http://127.0.0.1:8787",
      "/sandbox": "http://127.0.0.1:8787",
    },
  },
});
