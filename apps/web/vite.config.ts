import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

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
      // PW_API_PORT lets parallel e2e agents point Vite at their API server.
      "/api": {
        target: `http://127.0.0.1:${process.env.PW_API_PORT ?? "8787"}`,
        ws: true,
      },
    },
  },
})
