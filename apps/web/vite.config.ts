import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

/** E2E may set PW_API_PORT so parallel agents do not share 8787. */
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
