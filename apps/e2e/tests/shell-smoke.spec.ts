import { expect, test } from "@playwright/test"
import { cancelLiveRuns, startRun } from "./helpers"

const routes = [
  { path: "/docket", ready: "docket-page" },
  { path: "/inbox", ready: "mock-inbox-page" },
  { path: "/workflows", ready: "mock-workflows-page" },
  { path: "/runs", ready: "mock-runs-page" },
  { path: "/connectors", ready: "mock-connectors-page" },
  { path: "/library", ready: "mock-library-page" },
  { path: "/skills", ready: "mock-skills-page" },
  { path: "/files", ready: "mock-files-page" },
  { path: "/brand", ready: "brand-page" },
] as const

test.describe("shell smoke (BL-185)", () => {
  for (const route of routes) {
    test(`${route.path} loads without page errors`, async ({ page }) => {
      const errors: string[] = []
      page.on("pageerror", (err) => errors.push(err.message))
      await page.goto(route.path)
      await expect(page.getByTestId(route.ready).first()).toBeVisible({
        timeout: 30_000,
      })
      // Ignore React DOM-nesting warnings (brand cards nest links in crumbs).
      const real = errors.filter(
        (m) => !/cannot contain a nested|ValidateDOMNesting/i.test(m)
      )
      expect(real, real.join("\n")).toEqual([])
    })
  }

  test("inbox badge", async ({ page }) => {
    // Free the approval workflow slot before sampling the badge baseline.
    await cancelLiveRuns("node-approval-home")
    await page.goto("/docket")
    await expect(page.getByTestId("app-sidebar")).toBeVisible()
    const badge = page.getByTestId("inbox-badge")
    await expect(badge).toBeVisible()
    // Other specs may leave connector items; only assert the count rises.
    const before = Number((await badge.textContent())?.trim() || "0")

    await startRun("node-approval-home")
    await expect
      .poll(async () => Number((await badge.textContent())?.trim() || "0"), {
        timeout: 20_000,
      })
      .toBeGreaterThan(before)
  })
})
