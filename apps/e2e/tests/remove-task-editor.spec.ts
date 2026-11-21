import { expect, test } from "@playwright/test"
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const HOME = process.env.FLOWAPP_HOME!
const isMac = process.platform === "darwin"
const diamondPath = () => join(HOME, "workflows", "diamond", "workflow.yaml")
const diamondYaml = () => readFileSync(diamondPath(), "utf8")

test.describe("remove task in editor", () => {
  test("delete button opens confirm with dependents, undo, then save", async ({
    page,
  }) => {
    const original = diamondYaml()
    await page.goto("/workflows/diamond")
    await expect(page.getByTestId("node-a")).toBeVisible({ timeout: 15_000 })
    await page.getByTestId("node-a").click()
    await expect(page.getByTestId("delete-task")).toBeEnabled()

    await page.getByTestId("delete-task").click()
    await expect(page.getByTestId("confirm-dialog")).toBeVisible()
    await expect(page.getByTestId("delete-task-body")).toContainText("b")
    await expect(page.getByTestId("delete-task-body")).toContainText("c")
    await page.screenshot({ path: "test-results/delete-task-confirm.png" })

    await page.getByTestId("confirm-ok").click()
    await expect(page.getByTestId("confirm-dialog")).toBeHidden()
    await expect(page.getByTestId("node-a")).toHaveCount(0)
    await expect(page.getByTestId("yaml-pane")).not.toContainText("id: a")
    await expect(page.getByTestId("save-button")).toBeEnabled()

    await page.keyboard.press(isMac ? "Meta+z" : "Control+z")
    await expect(page.getByTestId("node-a")).toBeVisible()
    await expect(page.getByTestId("yaml-pane")).toContainText("id: a")

    await page.getByTestId("node-a").click()
    await page.getByTestId("delete-task").click()
    await page.getByTestId("confirm-ok").click()
    await expect(page.getByTestId("node-a")).toHaveCount(0)

    await page.getByTestId("save-button").click()
    await expect(page.getByTestId("save-button")).toBeDisabled({
      timeout: 10_000,
    })
    const onDisk = diamondYaml()
    expect(onDisk).not.toContain("id: a")
    expect(onDisk).toContain("id: b")
    await page.screenshot({ path: "test-results/delete-task-saved.png" })
    writeFileSync(diamondPath(), original)
  })

  test("Delete key opens confirm; ignored while typing", async ({ page }) => {
    // Leaf task: nothing depends on d (even after the prior test removes a).
    await page.goto("/workflows/diamond")
    await expect(page.getByTestId("node-d")).toBeVisible({ timeout: 15_000 })
    await page.getByTestId("node-d").click()
    await page.getByTestId("field-task-name").fill("Delta")
    await page.getByTestId("field-task-name").click()
    await page.keyboard.press("Backspace")
    await expect(page.getByTestId("confirm-dialog")).toHaveCount(0)
    await expect(page.getByTestId("node-d")).toBeVisible()
    await expect(page.getByTestId("field-task-name")).toHaveValue("Delt")

    await page.getByTestId("graph-canvas").click({ position: { x: 8, y: 8 } })
    await page.getByTestId("node-d").click()
    await page.keyboard.press("Delete")
    await expect(page.getByTestId("confirm-dialog")).toBeVisible()
    await expect(page.getByTestId("delete-task-body")).toContainText(
      "No other tasks depend"
    )
    await page.getByTestId("confirm-cancel").click()
    await expect(page.getByTestId("node-d")).toBeVisible()
    await page.screenshot({ path: "test-results/delete-task-key.png" })
  })

  test("last task cannot be deleted", async ({ page }) => {
    await page.goto("/workflows/fail-retry")
    await expect(page.getByTestId("node-flaky")).toBeVisible({
      timeout: 15_000,
    })
    await page.getByTestId("node-flaky").click()
    await expect(page.getByTestId("delete-task")).toBeDisabled()
    await page.getByTestId("node-flaky").click()
    await page.keyboard.press("Delete")
    await expect(page.getByTestId("confirm-dialog")).toHaveCount(0)
    await expect(page.getByTestId("node-flaky")).toBeVisible()
    await page.screenshot({ path: "test-results/delete-task-last.png" })
  })
})
