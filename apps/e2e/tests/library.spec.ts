import { expect, test } from "@playwright/test"

/** Click the name cell so tag badges in the row do not steal the click. */
async function openItem(page: import("@playwright/test").Page, id: string) {
  await page
    .getByTestId(`library-row-${id}`)
    .locator(".font-medium")
    .first()
    .click()
}

async function screenshotThemes(
  page: import("@playwright/test").Page,
  name: string
) {
  await page.screenshot({
    path: `test-results/${name}-light.png`,
    fullPage: true,
  })
  await page.locator("body").click({ position: { x: 0, y: 0 } })
  await page.keyboard.press("d")
  await expect(page.locator("html")).toHaveClass(/dark/)
  await page.screenshot({
    path: `test-results/${name}-dark.png`,
    fullPage: true,
  })
  await page.keyboard.press("d")
  await expect(page.locator("html")).toHaveClass(/light/)
}

test.describe("library page", () => {
  test("providers", async ({ page }) => {
    await page.goto("/library")
    await expect(page.getByTestId("library-page")).toBeVisible()
    await page.getByTestId("library-providers-open").click()
    await expect(page.getByTestId("providers-dialog")).toBeVisible()
    await expect(page.getByTestId("provider-github")).toBeVisible()
    await expect(page.getByTestId("provider-confluence")).toBeVisible()
    await expect(page.getByTestId("provider-rally")).toBeVisible()

    await page.getByTestId("provider-add-open").click()
    await expect(page.getByTestId("provider-form")).toBeVisible()
    await page.locator("#pv-name").fill("Grafana")
    await page.locator("#pv-pattern").fill("grafana[^/]*/d/(?<id>[^/]+)")
    await page.locator("#pv-files").fill("dashboard.json")
    await page.locator("#pv-fetch").fill("Grafana API")
    await page.getByTestId("provider-add-submit").click()
    await expect(page.getByTestId("provider-grafana")).toBeVisible()
    await expect(page.getByTestId("library-kind-grafana")).toBeVisible()
  })

  test("list", async ({ page }) => {
    await page.goto("/library")
    await expect(page.getByTestId("library-page")).toBeVisible()
    await expect(page.getByTestId("library-row-github-acme-demo")).toBeVisible()
    await expect(page.getByTestId("library-row-local-notes")).toBeVisible()
    await page.getByTestId("library-view-gallery").click()
    await expect(
      page.getByTestId("library-tile-github-acme-demo")
    ).toBeVisible()
    await screenshotThemes(page, "library-list")
  })

  test("sheet", async ({ page }) => {
    await page.goto("/library")
    await openItem(page, "github-acme-demo")
    await expect(page.getByTestId("library-sheet")).toBeVisible()
    await expect(page.getByTestId("library-remote")).toBeVisible()
    await expect(page.getByTestId("library-files")).toBeVisible()
    await page.getByTestId("library-tab-versions").click()
    await expect(page.getByTestId("library-versions")).toBeVisible()
    await expect(page.getByTestId("library-version-1")).toBeVisible()
    await expect(page.getByTestId("library-version-2")).toBeVisible()
    await screenshotThemes(page, "library-sheet")
  })

  test("pin", async ({ page }) => {
    await page.goto("/library")
    await openItem(page, "github-acme-demo")
    await page.getByTestId("library-tab-versions").click()
    await expect(page.getByTestId("library-version-2")).toContainText("Current")
    await page.getByTestId("library-pin-1").click()
    await expect(page.getByTestId("library-version-1")).toContainText("Current")
    await expect(page.getByTestId("library-pin-2")).toBeVisible()
  })

  test("remote", async ({ page }) => {
    await page.goto("/library")
    await openItem(page, "github-acme-demo")
    await expect(page.getByTestId("library-fetch")).toBeVisible()
    await page.getByTestId("library-tab-versions").click()
    const before = await page
      .getByTestId("library-versions")
      .locator("[data-testid^=library-version-]")
      .count()
    await page.getByTestId("library-fetch").click()
    await expect(page.getByTestId("library-fetch")).toHaveText("Fetch", {
      timeout: 15_000,
    })
    await expect(
      page
        .getByTestId("library-versions")
        .locator("[data-testid^=library-version-]")
    ).toHaveCount(before + 1, { timeout: 15_000 })

    await page.getByTestId("library-menu").click()
    await page.getByTestId("library-push").click()
    await expect(page.getByTestId("library-fetch")).toHaveText("Fetch", {
      timeout: 15_000,
    })
    await expect(
      page
        .getByTestId("library-versions")
        .locator("[data-testid^=library-version-]")
    ).toHaveCount(before + 2, { timeout: 15_000 })

    await page.getByTestId("library-menu").click()
    await page.getByTestId("library-unlink").click()
    await expect(page.getByTestId("library-remote")).toContainText(
      "Only on this machine"
    )
  })

  test("chrome", async ({ page }) => {
    await page.goto("/library")
    await expect(page.getByTestId("library-search")).toBeVisible()
    await expect(page.getByTestId("library-kind-github")).toBeVisible()
    await page.getByTestId("library-search").fill("Scratch")
    await expect(page.getByTestId("library-row-local-notes")).toBeVisible()
    await expect(page.getByTestId("library-row-github-acme-demo")).toHaveCount(
      0
    )
    await page.getByTestId("library-view-gallery").click()
    await expect(page.getByTestId("library-gallery")).toBeVisible()
  })

  test("add", async ({ page }) => {
    await page.goto("/library")
    await page.getByTestId("library-add-open").click()
    await expect(page.getByTestId("library-add")).toBeVisible()
    await page.getByTestId("library-add-tab-disk").click()
    await page.getByTestId("disk-file-input").setInputFiles({
      name: "notes.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# From disk\n"),
    })
    await page.locator("#lib-title").fill("Disk notes")
    await page.locator("#lib-tags").fill("type:import")
    await page.getByTestId("library-add-submit").click()
    await expect(page.getByTestId("library-sheet")).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByTestId("library-row-disk-notes")).toBeVisible()
  })

  test("detect", async ({ page }) => {
    await page.goto("/library")
    await page.getByTestId("library-add-open").click()
    await page
      .getByTestId("library-link-url")
      .fill("https://github.com/acme/fresh-repo")
    await expect(page.getByTestId("library-detected")).toContainText("GitHub")
    await expect(page.getByTestId("library-detected")).toContainText(
      "acme/fresh-repo"
    )
  })

  test("disk pick", async ({ page }) => {
    await page.goto("/library")
    await page.getByTestId("library-add-open").click()
    await page.getByTestId("library-add-tab-disk").click()
    await expect(page.getByTestId("disk-picker")).toBeVisible()
    await expect(page.getByTestId("disk-choose-file")).toBeVisible()
    await expect(page.getByTestId("disk-choose-folder")).toBeVisible()
    await page.getByTestId("disk-file-input").setInputFiles({
      name: "pick-me.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("picked\n"),
    })
    await expect(page.getByTestId("disk-picker")).toContainText("pick-me.md")
  })

  test("tags", async ({ page }) => {
    await page.goto("/library")
    await expect(page.getByTestId("library-tag-rail")).toBeVisible()
    await page.getByTestId("library-tag-rail").getByText("notes").click()
    await expect(page.getByTestId("library-active-tags")).toBeVisible()
    await expect(page.getByTestId("library-row-local-notes")).toBeVisible()
    await expect(page.getByTestId("library-row-github-acme-demo")).toHaveCount(
      0
    )

    await openItem(page, "local-notes")
    await page.getByTestId("library-tab-details").click()
    await page.getByTestId("library-tag-input").fill("epic:EP7")
    await page.getByRole("button", { name: "Add" }).click()
    await expect(page.getByTestId("library-tag-editor")).toContainText("EP7")
  })

  test("remove", async ({ page }) => {
    await page.goto("/library")
    await openItem(page, "local-notes")
    await expect(page.getByTestId("library-sheet")).toBeVisible()
    await page.getByTestId("library-menu").click()
    await page.getByTestId("library-remove").click()
    await expect(page.getByTestId("confirm-dialog")).toBeVisible()
    await page.getByTestId("confirm-ok").click()
    await expect(page.getByTestId("library-row-local-notes")).toHaveCount(0)
    await expect(page.getByTestId("library-row-github-acme-demo")).toBeVisible()
  })
})
