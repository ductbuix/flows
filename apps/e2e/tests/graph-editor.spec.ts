import { expect, test } from "@playwright/test"
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const HOME = process.env.FLOWAPP_HOME!

test.describe("graph editor", () => {
  test("add task in graph, save, YAML and disk update", async ({ page }) => {
    await page.goto("/workflows/diamond")
    await expect(page.getByTestId("graph-canvas")).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByTestId("node-a")).toBeVisible()

    await page.getByRole("button", { name: "Add task" }).click()
    await expect(page.getByTestId("node-task-1")).toBeVisible()
    await expect(page.getByTestId("yaml-pane")).toContainText("task-1")

    await page.getByTestId("save-button").click()
    await expect(page.getByTestId("save-button")).toBeDisabled({
      timeout: 10_000,
    })

    const onDisk = readFileSync(
      join(HOME, "workflows", "diamond", "workflow.yaml"),
      "utf8"
    )
    expect(onDisk).toContain("id: task-1")
  })

  test("edit YAML rename updates the node label", async ({ page }) => {
    await page.goto("/workflows/fail-retry")
    await expect(page.getByTestId("node-flaky")).toBeVisible({
      timeout: 15_000,
    })

    const detail = await page.evaluate(async () => {
      const res = await fetch("/api/workflows/fail-retry")
      return (await res.json()) as { yaml: string }
    })
    const next = detail.yaml.replace(/\bid: flaky\b/, "id: renamed")

    // Drive the YAML pane through the React onChange path by typing.
    const content = page.getByTestId("yaml-pane").locator(".cm-content")
    await content.click()
    await page.keyboard.press("Meta+A")
    // insertText keeps CodeMirror's change handlers.
    await page.keyboard.insertText(next)
    await expect(page.getByTestId("node-renamed")).toBeVisible({
      timeout: 10_000,
    })
  })

  test("invalid YAML shows errors and keeps graph", async ({ page }) => {
    await page.goto("/workflows/diamond")
    await expect(page.getByTestId("node-a")).toBeVisible({ timeout: 15_000 })

    const content = page.getByTestId("yaml-pane").locator(".cm-content")
    await content.click()
    await page.keyboard.press("Meta+A")
    await page.keyboard.insertText("id: broken\ntasks: []\n")
    await expect(page.getByTestId("yaml-errors")).toBeVisible()
    // Last valid workflow is kept when parse fails zod.
    await expect(page.getByTestId("node-a")).toBeVisible()
  })

  test("disk change with dirty editor opens conflict dialog", async ({
    page,
  }) => {
    await page.goto("/workflows/fail-retry")
    await expect(page.getByTestId("graph-canvas")).toBeVisible({
      timeout: 15_000,
    })

    const content = page.getByTestId("yaml-pane").locator(".cm-content")
    await content.click()
    await page.keyboard.press("End")
    await page.keyboard.type("\n# local edit\n")
    await expect(page.getByTestId("save-button")).toBeEnabled()

    const path = join(HOME, "workflows", "fail-retry", "workflow.yaml")
    const disk = readFileSync(path, "utf8")
    writeFileSync(path, `${disk}\n# disk edit\n`)

    await expect(page.getByTestId("conflict-dialog")).toBeVisible({
      timeout: 15_000,
    })
    await page.getByTestId("conflict-reload").click()
    await expect(page.getByTestId("conflict-dialog")).toBeHidden()
    await expect(page.getByTestId("yaml-pane")).toContainText("disk edit")
  })
})
