import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

/** API port for the Vite proxy; e2e sets PW_API_PORT for parallel agents. */
const apiPort = process.env.PW_API_PORT ?? "8787"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    host: "127.0.0.1",
    proxy: {
      "/api": { target: `http://127.0.0.1:${apiPort}`, ws: true },
    },
  },
})
