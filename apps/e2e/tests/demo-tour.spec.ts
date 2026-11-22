import { expect, test } from "@playwright/test"

// Records a walkthrough video of the Journey-led pages (BL-037 to BL-056).
// Run: DEMO=1 PW_VIDEO=on pnpm --filter e2e exec playwright test demo-tour
test.skip(!process.env.DEMO, "demo recording only (set DEMO=1)")
test.use({ viewport: { width: 1280, height: 760 } })

const beat = (page: import("@playwright/test").Page, ms = 1600) =>
  page.waitForTimeout(ms)

test("feature tour", async ({ page }) => {
  await page.goto("/")
  await beat(page)

  await page.getByTestId("sidebar-platform-work-items").click()
  await expect(page.getByTestId("work-items-page")).toBeVisible()
  await beat(page)
  await page.getByTestId("work-items-new").click()
  await page
    .getByTestId("work-item-create-title")
    .pressSequentially("Fix login timeout", { delay: 60 })
  await page.getByTestId("work-item-create-workflow").click()
  await page.getByRole("option", { name: "diamond" }).click()
  await beat(page)
  await page.getByTestId("work-item-create-submit").click()
  await beat(page, 2500)

  await page.goto("/workflows/diamond")
  await beat(page, 2500)
  await page.goto("/workflows/diamond?tab=editor")
  await expect(page.getByTestId("graph-canvas")).toBeVisible()
  await beat(page)
  await page.getByTestId("editor-tab-yaml").click()
  await beat(page, 2000)

  await page.goto("/connections")
  await beat(page, 2500)
  await page.getByRole("tab", { name: /library/i }).click()
  await beat(page, 2000)

  await page.goto("/runs")
  await beat(page, 2500)
  await page.goto("/settings")
  await beat(page, 2000)
})
