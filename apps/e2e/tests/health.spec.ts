import { expect, test } from "@playwright/test"

test("home page shows the server is healthy", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { name: "Flows" })).toBeVisible()
  await expect(page.getByTestId("health")).toHaveText(
    /^server ok v\d+\.\d+\.\d+$/
  )
})
