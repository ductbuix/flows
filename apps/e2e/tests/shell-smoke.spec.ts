import { expect, test } from "@playwright/test"
import { startRun } from "./helpers"

const routes = [
  { path: "/docket", ready: "docket-page" },
  { path: "/inbox", ready: "inbox-page" },
  { path: "/workflows", ready: "workflows-page" },
  { path: "/runs", ready: "runs-page" },
  { path: "/connectors", ready: "connectors-page" },
  { path: "/library", ready: "library-page" },
  { path: "/skills", ready: "skills-page" },
  { path: "/files", ready: "files-page" },
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
    await page.goto("/docket")
    await expect(page.getByTestId("app-sidebar")).toBeVisible()
    await expect(page.getByTestId("inbox-badge")).toBeVisible()
    await expect(page.getByTestId("inbox-badge")).toHaveText("")

    await startRun("node-approval-home")
    await expect(page.getByTestId("inbox-badge")).toHaveText(/^[1-9]\d*$/, {
      timeout: 20_000,
    })
  })

  test("app names", async ({ page }) => {
    await page.goto("/docket")
    await expect(page.getByTestId("app-sidebar")).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByTestId("docket-page")).toBeVisible()
    await expect(page.locator("[data-testid^='mock-']")).toHaveCount(0)
  })

  test("no mock routes", async ({ page }) => {
    await page.goto("/mock/docket")
    await expect(page.getByTestId("app-sidebar")).toHaveCount(0)
    await expect(page.getByTestId("docket-page")).toHaveCount(0)
  })
})
