import { test, expect, _electron as electron } from "@playwright/test"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { materializeSmokeHome, removeSmokeHome } from "../playwright.config.ts"
import { startAttachDaemon } from "./attach-daemon.ts"

const root = dirname(fileURLToPath(import.meta.url))
const desktopRoot = join(root, "..")
const repoRoot = join(desktopRoot, "../..")

async function expectDocket(
  window: Awaited<
    ReturnType<Awaited<ReturnType<typeof electron.launch>>["firstWindow"]>
  >
) {
  await expect(window.getByTestId("docket-page")).toBeVisible({
    timeout: 30_000,
  })
  await expect(window.getByTestId("docket-card-alpha")).toBeVisible({
    timeout: 20_000,
  })
  await expect(window.getByTestId("docket-card-beta")).toBeVisible()
  await expect(window.getByText("Alpha card")).toBeVisible()
  await expect(window.getByText("Beta card")).toBeVisible()
}

test.describe("Electron desktop smoke", () => {
  test("own path: no lock starts utility host and lists Docket", async () => {
    const home = materializeSmokeHome()
    const electronApp = await electron.launch({
      args: [join(desktopRoot, "dist/main.cjs")],
      cwd: desktopRoot,
      env: {
        ...process.env,
        FLOWAPP_HOME: home,
        FLOWAPP_WEB_DIST: join(repoRoot, "apps/web/dist"),
      },
    })

    try {
      await expectDocket(await electronApp.firstWindow())
    } finally {
      await electronApp.close()
      removeSmokeHome(home)
    }
  })

  test("attach path: live daemon lock connects over WebSocket", async () => {
    const home = materializeSmokeHome()
    const daemon = await startAttachDaemon(home)
    const electronApp = await electron.launch({
      args: [join(desktopRoot, "dist/main.cjs")],
      cwd: desktopRoot,
      env: {
        ...process.env,
        FLOWAPP_HOME: home,
        FLOWAPP_WEB_DIST: join(repoRoot, "apps/web/dist"),
      },
    })

    try {
      await expectDocket(await electronApp.firstWindow())
    } finally {
      await electronApp.close()
      daemon.close()
      removeSmokeHome(home)
    }
  })
})
