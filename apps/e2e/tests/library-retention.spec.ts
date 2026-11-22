import { mkdirSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { expect, test } from "@playwright/test"

test.describe("library retention UI (BL-047)", () => {
  test("Library tab shows size warning at 80 percent", async ({ page }) => {
    const home = process.env.FLOWAPP_HOME
    expect(home).toBeTruthy()
    const configPath = join(home!, "config.yaml")
    writeFileSync(configPath, "library:\n  maxBytes: 1000\n")
    try {
      const entityRoot = join(home!, "library", "demo", "item", "pad")
      const rev = join(entityRoot, "rev-pad")
      mkdirSync(rev, { recursive: true })
      writeFileSync(
        join(rev, "meta.json"),
        JSON.stringify({
          pulledAt: new Date().toISOString(),
          title: "Pad",
          connection: "demo",
          kind: "item",
          entityId: "pad",
        })
      )
      writeFileSync(join(rev, "blob.bin"), "x".repeat(900))
      symlinkSync("rev-pad", join(entityRoot, "current"))

      await page.goto("/connections?tab=library")
      await expect(page.getByTestId("library-tab")).toBeVisible()
      await expect(page.getByTestId("library-size-warning")).toBeVisible()
      await page.screenshot({
        path: "test-results/library-size-warning-light.png",
        fullPage: true,
      })
    } finally {
      try {
        unlinkSync(configPath)
      } catch {
        // ignore missing config
      }
    }
  })
})
