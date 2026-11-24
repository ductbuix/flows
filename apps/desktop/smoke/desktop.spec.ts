import { test, expect, _electron as electron } from "@playwright/test"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { materializeSmokeHome, removeSmokeHome } from "../playwright.config.ts"
import { startAttachDaemon } from "./attach-daemon.ts"

const root = dirname(fileURLToPath(import.meta.url))
const desktopRoot = join(root, "..")
const repoRoot = join(desktopRoot, "../..")
const SMOKE_BLOB_ID = "b_smoke_card_image"

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

/** Card image via flows-blob://; unknown ids 404 (BL-188). */
async function expectCardBlobImage(
  window: Awaited<
    ReturnType<Awaited<ReturnType<typeof electron.launch>>["firstWindow"]>
  >
) {
  const missing = await window.evaluate(async () => {
    const res = await fetch("flows-blob://no-such-blob")
    return res.status
  })
  expect(missing).toBe(404)

  await window.evaluate(async (blobId) => {
    const img = document.createElement("img")
    img.dataset.testid = "card-blob-image"
    img.alt = "card"
    img.src = `flows-blob://${blobId}`
    document.body.appendChild(img)
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error("card image failed to load"))
    })
  }, SMOKE_BLOB_ID)

  await expect(window.getByTestId("card-blob-image")).toBeVisible()
  const size = await window
    .getByTestId("card-blob-image")
    .evaluate((el: HTMLImageElement) => ({
      w: el.naturalWidth,
      h: el.naturalHeight,
    }))
  expect(size.w).toBeGreaterThan(0)
  expect(size.h).toBeGreaterThan(0)
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
      const window = await electronApp.firstWindow()
      await expectDocket(window)
      await expectCardBlobImage(window)
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

  test("reveal path via stubbed shell (BL-189)", async () => {
    const home = materializeSmokeHome()
    const revealLog = join(home, "reveal.log")
    const electronApp = await electron.launch({
      args: [join(desktopRoot, "dist/main.cjs")],
      cwd: desktopRoot,
      env: {
        ...process.env,
        FLOWAPP_HOME: home,
        FLOWAPP_WEB_DIST: join(repoRoot, "apps/web/dist"),
        FLOWAPP_REVEAL_STUB: revealLog,
      },
    })

    try {
      const window = await electronApp.firstWindow()
      await expectDocket(window)
      await window.evaluate(() => {
        const api = (
          globalThis as unknown as {
            flowsDesktop?: { revealPath: (path: string) => void }
          }
        ).flowsDesktop
        api!.revealPath("/tmp/flows-smoke-reveal")
      })
      await expect
        .poll(() => {
          try {
            return readFileSync(revealLog, "utf8")
          } catch {
            return ""
          }
        })
        .toContain("/tmp/flows-smoke-reveal")
    } finally {
      await electronApp.close()
      removeSmokeHome(home)
    }
  })
})
