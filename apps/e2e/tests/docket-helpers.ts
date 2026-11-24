import { expect, type Page } from "@playwright/test"

export async function screenshotThemes(page: Page, name: string) {
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

export function uniqueTitle() {
  return `bl216-${Date.now()}`
}

export function cardIdForTitle(title: string) {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "card"
  )
}

export async function gotoDocket(page: Page) {
  await page.goto("/docket")
  await expect(page.getByTestId("docket-page")).toBeVisible()
}

export async function createCard(
  page: Page,
  title: string,
  opts?: { column?: string; body?: string; ref?: string }
) {
  if (opts?.column) {
    await page.getByTestId(`docket-add-${opts.column}`).click()
  } else {
    await page.getByTestId("docket-new-card-open").click()
  }
  const dialog = page.getByTestId("docket-new-card")
  await expect(dialog).toBeVisible()
  await page.getByTestId("docket-new-card-title").fill(title)
  if (opts?.ref) await page.getByTestId("docket-new-card-ref").fill(opts.ref)
  if (opts?.body) await dialog.locator("#nc-body").fill(opts.body)
  await page.getByTestId("docket-new-card-submit").click()
  await expect(page.getByTestId("docket-panel")).toBeVisible()
  const id = cardIdForTitle(title)
  await expect(page.getByTestId(`docket-card-${id}`)).toBeVisible()
  return id
}

export async function openFixLogin(page: Page) {
  await gotoDocket(page)
  await page.getByTestId("docket-card-fix-login").click()
  await expect(page.getByTestId("docket-panel")).toBeVisible()
}
