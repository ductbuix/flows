import { expect, test } from "@playwright/test"
import { readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { disableAdvanced, enableAdvanced } from "./helpers"

const HOME = process.env.FLOWAPP_HOME!
const failRetryPath = () =>
  join(HOME, "workflows", "fail-retry", "workflow.yaml")

test.describe("editor AI Elements (BL-029)", () => {
  test("Advanced on and off, parse error, prompt, model and effort", async ({
    page,
  }) => {
    const originalYaml = readFileSync(failRetryPath(), "utf8")
    await page.goto("/workflows/fail-retry")
    await expect(page.getByTestId("graph-canvas")).toBeVisible({
      timeout: 15_000,
    })
    await disableAdvanced(page)
    await expect(page.getByTestId("yaml-pane")).toHaveCount(0)
    await expect(page.getByTestId("graph-controls")).toBeVisible()
    await page.screenshot({
      path: "test-results/editor-advanced-off-light.png",
      fullPage: true,
    })

    await enableAdvanced(page)
    await expect(page.getByTestId("yaml-pane")).toBeVisible()
    await page.screenshot({
      path: "test-results/editor-advanced-on-light.png",
      fullPage: true,
    })

    const content = page.getByTestId("yaml-pane").locator(".cm-content")
    await content.click()
    await page.keyboard.press("Meta+A")
    await page.keyboard.insertText("id: broken\ntasks: []\n")
    await expect(page.getByTestId("yaml-errors")).toBeVisible()

    await page.getByTestId("advanced-switch-control").click()
    await expect(page.getByTestId("yaml-pane")).toHaveCount(0)
    await expect(page.getByTestId("yaml-errors")).toBeVisible()
    await expect(page.getByTestId("open-advanced-yaml")).toBeVisible()
    await page.getByTestId("open-advanced-yaml").click()
    await expect(page.getByTestId("yaml-pane")).toBeVisible()
    await expect(page.getByTestId("advanced-switch-control")).toBeChecked()

    await page.goto("/workflows/fail-retry")
    await expect(page.getByTestId("node-flaky")).toBeVisible({
      timeout: 15_000,
    })
    await page.getByTestId("node-flaky").click()
    await page.getByTestId("field-kind").click()
    await page.getByRole("option", { name: "agent" }).click()
    await expect(page.getByTestId("model-selector")).toBeVisible()
    await expect(page.getByTestId("field-model")).toBeVisible()

    await page.getByTestId("field-model").click()
    await page.getByRole("menuitemradio", { name: "Sonnet" }).click()
    await expect(page.getByRole("menu")).toHaveCount(0)
    await expect(page.getByTestId("field-model")).toContainText("Sonnet")
    await page.getByTestId("field-effort").click()
    await page.getByRole("menuitemradio", { name: "High", exact: true }).click()
    await expect(page.getByRole("menu")).toHaveCount(0)
    await expect(page.getByTestId("field-effort")).toContainText("High")

    await enableAdvanced(page)
    await expect(page.getByTestId("yaml-pane")).toContainText("model: sonnet")
    await expect(page.getByTestId("yaml-pane")).toContainText("effort: high")

    await page.getByTestId("edit-prompt").click()
    await expect(page.getByTestId("prompt-editor")).toBeVisible()
    await page
      .getByTestId("prompt-editor")
      .locator("textarea")
      .fill("Prompt via Prompt Input.\n")
    await page.getByTestId("prompt-save").click()
    await expect(page.getByTestId("prompt-editor")).toBeHidden()

    await page.getByTestId("save-button").click()
    await expect(page.getByTestId("save-button")).toBeDisabled({
      timeout: 10_000,
    })

    const onDisk = readFileSync(
      join(HOME, "workflows", "fail-retry", "workflow.yaml"),
      "utf8"
    )
    expect(onDisk).toContain("model: sonnet")
    expect(onDisk).toContain("effort: high")
    expect(
      readFileSync(
        join(HOME, "workflows", "fail-retry", "tasks", "flaky", "prompt.md"),
        "utf8"
      )
    ).toContain("Prompt via Prompt Input.")

    await page.screenshot({
      path: "test-results/editor-model-prompt-light.png",
      fullPage: true,
    })

    await page.goto("/settings")
    await page.getByTestId("theme-toggle").getByText("Dark").click()
    await expect(page.locator("html")).toHaveClass(/dark/)
    await page.goto("/workflows/fail-retry")
    await expect(page.getByTestId("graph-canvas")).toBeVisible({
      timeout: 15_000,
    })
    await page.screenshot({
      path: "test-results/editor-advanced-off-dark.png",
      fullPage: true,
    })
    await enableAdvanced(page)
    await page.screenshot({
      path: "test-results/editor-advanced-on-dark.png",
      fullPage: true,
    })

    writeFileSync(failRetryPath(), originalYaml)
    rmSync(join(HOME, "workflows", "fail-retry", "tasks", "flaky"), {
      recursive: true,
      force: true,
    })
  })
})
