import { test, expect, _electron as electron } from "@playwright/test"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { materializeSmokeHome, removeSmokeHome } from "../playwright.config.ts"

const root = dirname(fileURLToPath(import.meta.url))
const desktopRoot = join(root, "..")
const repoRoot = join(desktopRoot, "../..")

test.describe("Electron desktop smoke", () => {
  test("app opens and Docket lists fixture cards", async () => {
    const home = materializeSmokeHome()
    const electronApp = await electron.launch({
      args: [join(desktopRoot, "dist/main.js")],
      cwd: desktopRoot,
      env: {
        ...process.env,
        FLOWAPP_HOME: home,
        FLOWAPP_WEB_DIST: join(repoRoot, "apps/web/dist"),
      },
    })

    try {
      const window = await electronApp.firstWindow()
      await expect(window.getByTestId("docket-page")).toBeVisible({
        timeout: 30_000,
      })
      await expect(window.getByTestId("docket-card-alpha")).toBeVisible({
        timeout: 20_000,
      })
      await expect(window.getByTestId("docket-card-beta")).toBeVisible()
      await expect(window.getByText("Alpha card")).toBeVisible()
      await expect(window.getByText("Beta card")).toBeVisible()
    } finally {
      await electronApp.close()
      removeSmokeHome(home)
    }
  })
})
