import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Vite config tuned for low-memory Raspberry Pi kiosk targets:
// - manual vendor chunking keeps the initial mirror shell small
// - route/feature code splitting is handled via React.lazy in the app
const isElectronBuild = process.env.ELECTRON === "1";

export default defineConfig(({ mode }) => ({
  base: isElectronBuild || mode === "electron" ? "./" : "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "es2022",
    cssCodeSplit: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "data-vendor": ["@tanstack/react-query", "zustand"],
          "supabase-vendor": ["@supabase/supabase-js"],
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
    strictPort: true,
    // Allow opening dev server from phone via LAN IP (Host header check)
    allowedHosts: true,
    hmr: {
      // Phones on LAN use the same port; avoid hardcoding localhost for HMR
      clientPort: 5173,
    },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:18010",
        changeOrigin: true,
        ws: true,
        secure: false,
      },
    },
  },
  preview: {
    port: 4173,
    host: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:18010",
        changeOrigin: true,
        ws: true,
        secure: false,
      },
    },
  },
}));
