import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"

/** Production CSP; dev keeps Vite's inline HMR scripts, so build only. */
const csp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: flows-blob: https:",
  "media-src 'self' blob: flows-blob:",
  "font-src 'self' data:",
  "connect-src 'self' ws://127.0.0.1:* http://127.0.0.1:* flows-blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ")

const cspPlugin: Plugin = {
  name: "flows-csp",
  apply: "build",
  transformIndexHtml: () => [
    {
      tag: "meta",
      attrs: { "http-equiv": "Content-Security-Policy", content: csp },
      injectTo: "head-prepend",
    },
  ],
}

/** API port for the Vite proxy; e2e sets PW_API_PORT for parallel agents. */
const apiPort = process.env.PW_API_PORT ?? "8787"

// https://vite.dev/config/
export default defineConfig({
  // Relative asset URLs so Electron can loadFile the dist (BL-186).
  base: process.env.FLOWAPP_DESKTOP_BUILD === "1" ? "./" : "/",
  plugins: [react(), tailwindcss(), cspPlugin],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
      "@workspace/contracts": resolve(
        import.meta.dirname,
        "../../packages/contracts/src/index.ts"
      ),
    },
  },
  server: {
    host: "127.0.0.1",
    proxy: {
      // changeOrigin so /fcp/bootstrap sees the daemon Host (DES-016 loopback).
      "/fcp": {
        target: `http://127.0.0.1:${apiPort}`,
        changeOrigin: true,
        ws: true,
      },
      "/blobs": {
        target: `http://127.0.0.1:${apiPort}`,
        changeOrigin: true,
      },
    },
  },
})
