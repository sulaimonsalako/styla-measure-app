import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const backendPort = process.env.BACKEND_PORT || process.env.PORT || 3457;

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "../public",
    emptyOutDir: false, // don't wipe charts.html / other static assets in public
  },
  server: {
    // In dev, proxy backend calls to the Express server the CLI runs.
    proxy: {
      "/api": { target: `http://localhost:${backendPort}`, changeOrigin: false, secure: false },
    },
  },
});
