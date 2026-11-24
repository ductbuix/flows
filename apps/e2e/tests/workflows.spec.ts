import { expect, test } from "@playwright/test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { e2eHome } from "./helpers"

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

test.describe("workflows page (BL-179)", () => {
  test("lists workflows, opens editor, creates one", async ({ page }) => {
    await page.goto("/workflows")
    await expect(page.getByTestId("mock-workflows-page")).toBeVisible()
    await expect(page.getByTestId("workflows-new-open")).toBeVisible()
    await expect(page.getByTestId("mock-workflow-diamond")).toBeVisible()
    await screenshotThemes(page, "workflows-page")

    await page.getByTestId("mock-workflow-diamond").click()
    await expect(page.getByTestId("workflow-sheet")).toBeVisible()
    await page.getByTestId("workflow-open-editor").click()
    await expect(page.getByTestId("mock-workflow-editor")).toBeVisible()
    await expect(page.getByTestId("workflow-canvas")).toBeVisible()
    await screenshotThemes(page, "workflow-editor")

    await page.goto("/workflows")
    await page.getByTestId("workflows-new-open").click()
    await expect(page.getByTestId("workflows-new")).toBeVisible()
    await page.getByTestId("workflows-new-name").fill("Ship workflows sdk")
    await page.getByTestId("workflows-new-submit").click()
    await expect(page.getByTestId("mock-workflow-editor")).toBeVisible()
    await page.getByTestId("workflow-editor-tab-yaml").click()
    await expect(page.getByTestId("workflow-editor-yaml")).toContainText(
      "ship-workflows-sdk"
    )
  })
})

test.describe("workflows.spec.ts › editor yaml", () => {
  test("YAML tab edits and keeps comments on save (WF-09)", async ({
    page,
  }) => {
    await page.goto("/workflows/diamond")
    await expect(page.getByTestId("mock-workflow-editor")).toBeVisible()
    await page.getByTestId("workflow-editor-tab-yaml").click()
    const yaml = page.getByTestId("workflow-editor-yaml")
    await expect(yaml).toContainText("id: diamond")
    const current = await yaml.inputValue()
    const withComment = current.replace(
      "goal: e2e node run",
      "# keep me\ngoal: e2e node run"
    )
    await yaml.fill(withComment)
    await page.getByTestId("workflow-editor-save").click()
    await expect(page.getByTestId("workflow-editor-save")).toBeDisabled()
    const onDisk = readFileSync(
      join(e2eHome(), "workflows", "diamond", "workflow.yaml"),
      "utf8"
    )
    expect(onDisk).toContain("# keep me")
    expect(onDisk).toContain("goal: e2e node run")
  })
})

test.describe("workflows.spec.ts › canvas", () => {
  test("opens saved layout and saves a move (WF-10)", async ({ page }) => {
    await page.goto("/workflows/diamond")
    await expect(page.getByTestId("workflow-canvas")).toBeVisible()
    await expect(page.getByTestId("canvas-node-trigger")).toBeVisible()
    await expect(page.getByTestId("canvas-node-command")).toBeVisible()
    await expect(page.getByTestId("canvas-node-output")).toBeVisible()

    const trigger = page.getByTestId("canvas-node-trigger")
    const box = await trigger.boundingBox()
    expect(box).toBeTruthy()
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
    await page.mouse.down()
    await page.mouse.move(box!.x + box!.width / 2 + 120, box!.y + 40, {
      steps: 8,
    })
    await page.mouse.up()

    await expect(page.getByTestId("workflow-editor-save")).toBeEnabled()
    await page.getByTestId("workflow-editor-save").click()
    await expect(page.getByTestId("workflow-editor-save")).toBeDisabled()

    const layout = JSON.parse(
      readFileSync(
        join(e2eHome(), "workflows", "diamond", "workflow.layout.json"),
        "utf8"
      )
    ) as { nodes: Record<string, { x: number; y: number }> }
    expect(layout.nodes.start).toBeDefined()
    expect(
      layout.nodes.start.x !== 40 || layout.nodes.start.y !== 80
    ).toBeTruthy()
  })
})
