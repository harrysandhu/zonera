import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// Dev: libraries come from node_modules.
// Build: React, ReactDOM and three load as pinned UMD globals from the CDN
// (see index.html), and the app itself is inlined into one HTML file so the
// demo can be published as a Claude artifact. Images stay as files in /img.
export default defineConfig(({ command }) => ({
  plugins: [react({ jsxRuntime: "classic" }), ...(command === "build" ? [viteSingleFile({ removeViteModuleLoader: true })] : [])],
  build: {
    target: "es2020",
    assetsInlineLimit: 0,
    rollupOptions: {
      external: ["react", "react-dom", "react-dom/client", "three"],
      output: {
        format: "iife",
        globals: { react: "React", "react-dom": "ReactDOM", "react-dom/client": "ReactDOM", three: "THREE" },
      },
    },
  },
}));
