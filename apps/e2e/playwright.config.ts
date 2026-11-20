import { defineConfig, devices } from "@playwright/test"
import { createE2eHome } from "./fixtures/home"

// Video and screenshots are on by default: they are the evidence for UI PRs.
// Override with PW_VIDEO / PW_SCREENSHOT (e.g. "retain-on-failure", "off").
type Video = "on" | "off" | "retain-on-failure" | "on-first-retry"
type Screenshot = "on" | "off" | "only-on-failure"
const video = (process.env.PW_VIDEO ?? "on") as Video
const screenshot = (process.env.PW_SCREENSHOT ?? "on") as Screenshot

const WEB_PORT = process.env.PW_WEB_PORT ?? "5173"
const API_PORT = process.env.PW_API_PORT ?? "8787"
const WEB = `http://127.0.0.1:${WEB_PORT}`
const API = `http://127.0.0.1:${API_PORT}`

const FLOWAPP_HOME = process.env.FLOWAPP_HOME ?? createE2eHome()
process.env.FLOWAPP_HOME = FLOWAPP_HOME
process.env.PW_API_BASE = API

const stringEnv = (): Record<string, string> =>
  Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined
    )
  )

export default defineConfig({
  testDir: "tests",
  outputDir: "test-results",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: WEB,
    trace: "retain-on-failure",
    video,
    screenshot,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "pnpm --filter server start",
      url: `${API}/api/health`,
      reuseExistingServer: !process.env.CI,
      cwd: "../..",
      env: {
        ...stringEnv(),
        FLOWAPP_HOME,
        FLOWAPP_RETRY_BACKOFF_MS: "50",
        PORT: API_PORT,
      },
    },
    {
      command: `pnpm --filter web exec vite --port ${WEB_PORT} --strictPort`,
      url: WEB,
      reuseExistingServer: !process.env.CI,
      cwd: "../..",
      env: stringEnv(),
    },
  ],
})
