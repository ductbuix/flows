import { defineConfig, devices } from "@playwright/test"

// Video and screenshots are on by default: they are the evidence for UI PRs.
// Override with PW_VIDEO / PW_SCREENSHOT (e.g. "retain-on-failure", "off").
type Video = "on" | "off" | "retain-on-failure" | "on-first-retry"
type Screenshot = "on" | "off" | "only-on-failure"
const video = (process.env.PW_VIDEO ?? "on") as Video
const screenshot = (process.env.PW_SCREENSHOT ?? "on") as Screenshot

const WEB = "http://127.0.0.1:5173"
const API = "http://127.0.0.1:8787"

export default defineConfig({
  testDir: "tests",
  outputDir: "test-results",
  fullyParallel: true,
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
    },
    {
      command: "pnpm --filter web exec vite --port 5173 --strictPort",
      url: WEB,
      reuseExistingServer: !process.env.CI,
      cwd: "../..",
    },
  ],
})
