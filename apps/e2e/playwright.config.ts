import { defineConfig, devices } from "@playwright/test"
import { createE2eHome, createNodesE2eHome } from "./fixtures/home"

// Video and screenshots are on by default: they are the evidence for UI PRs.
// Override with PW_VIDEO / PW_SCREENSHOT (e.g. "retain-on-failure", "off").
type Video = "on" | "off" | "retain-on-failure" | "on-first-retry"
type Screenshot = "on" | "off" | "only-on-failure"
const video = (process.env.PW_VIDEO ?? "on") as Video
const screenshot = (process.env.PW_SCREENSHOT ?? "on") as Screenshot

const WEB_PORT = process.env.PW_WEB_PORT ?? "5173"
const API_PORT = process.env.PW_API_PORT ?? "8787"
const NODES_WEB_PORT = process.env.PW_NODES_WEB_PORT ?? "5174"
const NODES_API_PORT = process.env.PW_NODES_API_PORT ?? "8788"
const WEB = `http://127.0.0.1:${WEB_PORT}`
const API = `http://127.0.0.1:${API_PORT}`

const FLOWAPP_HOME = process.env.FLOWAPP_HOME ?? createE2eHome()
process.env.FLOWAPP_HOME = FLOWAPP_HOME
process.env.FLOWAPP_CURSOR_PROJECTS =
  process.env.FLOWAPP_CURSOR_PROJECTS ?? `${FLOWAPP_HOME}/.cursor-projects`
process.env.PW_API_BASE = API

// Second stack with FLOWS_NODES=1 for node-*.spec.ts (DES-037 Rollout).
const NODES_HOME = process.env.PW_NODES_HOME ?? createNodesE2eHome()
process.env.PW_NODES_HOME = NODES_HOME
process.env.PW_NODES_WEB = `http://127.0.0.1:${NODES_WEB_PORT}`

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
  // One shared FLOWAPP_HOME; parallel workers race on the same fixtures.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: WEB,
    trace: "retain-on-failure",
    video,
    screenshot,
  },
  projects: [
    {
      name: "chromium",
      testIgnore: /node-.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "nodes",
      testMatch: /node-.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: `http://127.0.0.1:${NODES_WEB_PORT}`,
      },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter server start",
      url: `${API}/api/health`,
      reuseExistingServer: !process.env.CI,
      cwd: "../..",
      env: {
        ...stringEnv(),
        FLOWAPP_HOME,
        FLOWAPP_CURSOR_PROJECTS: process.env.FLOWAPP_CURSOR_PROJECTS!,
        FLOWAPP_RETRY_BACKOFF_MS: "50",
        FLOWAPP_FAKE_CONNECTOR: "1",
        PORT: API_PORT,
      },
    },
    {
      command: `pnpm --filter web exec vite --port ${WEB_PORT} --strictPort`,
      url: WEB,
      reuseExistingServer: !process.env.CI,
      cwd: "../..",
      env: {
        ...stringEnv(),
        PW_API_PORT: API_PORT,
      },
    },
    {
      command: "pnpm --filter server start",
      url: `http://127.0.0.1:${NODES_API_PORT}/api/health`,
      reuseExistingServer: !process.env.CI,
      cwd: "../..",
      env: {
        ...stringEnv(),
        FLOWAPP_HOME: NODES_HOME,
        FLOWAPP_CURSOR_PROJECTS: `${NODES_HOME}/.cursor-projects`,
        FLOWAPP_FAKE_CONNECTOR: "1",
        FLOWS_NODES: "1",
        PORT: NODES_API_PORT,
      },
    },
    {
      command: `pnpm --filter web exec vite --port ${NODES_WEB_PORT} --strictPort`,
      url: `http://127.0.0.1:${NODES_WEB_PORT}`,
      reuseExistingServer: !process.env.CI,
      cwd: "../..",
      env: {
        ...stringEnv(),
        PW_API_PORT: NODES_API_PORT,
      },
    },
  ],
})
