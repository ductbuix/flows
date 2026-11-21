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
    const newNode = page.locator('[data-testid^="node-task-"]')
    await expect(newNode).toBeVisible()
    const nodeTestId = await newNode.getAttribute("data-testid")
    expect(nodeTestId).toMatch(/^node-task-[0-9a-f]{8}$/)
    const taskId = nodeTestId!.slice("node-".length)
    await expect(page.getByTestId("yaml-pane")).toContainText(taskId)
    await expect(page.getByTestId("field-task-id")).toHaveText(taskId)

    await page.getByTestId("save-button").click()
    await expect(page.getByTestId("save-button")).toBeDisabled({
      timeout: 10_000,
    })

    const onDisk = readFileSync(
      join(HOME, "workflows", "diamond", "workflow.yaml"),
      "utf8"
    )
    expect(onDisk).toContain(`id: ${taskId}`)
  })

  test("edit task name updates graph label", async ({ page }) => {
    await page.goto("/workflows/diamond")
    await expect(page.getByTestId("node-a")).toBeVisible({ timeout: 15_000 })
    await page.getByTestId("node-a").click()
    await page.getByTestId("field-task-name").fill("Alpha")
    await expect(page.getByTestId("node-a")).toContainText("Alpha")
    await expect(page.getByTestId("yaml-pane")).toContainText("name: Alpha")
    await expect(page.getByTestId("field-task-id")).toHaveText("a")

    await page.getByTestId("save-button").click()
    await expect(page.getByTestId("save-button")).toBeDisabled({
      timeout: 10_000,
    })
    await page.screenshot({ path: "test-results/edit-task-name.png" })
  })

  test("edit prompt creates tasks/<id>/prompt.md", async ({ page }) => {
    await page.goto("/workflows/fail-retry")
    await expect(page.getByTestId("node-flaky")).toBeVisible({
      timeout: 15_000,
    })
    await page.getByTestId("node-flaky").click()
    await page.getByTestId("field-kind").click()
    await page.getByRole("option", { name: "agent" }).click()
    await expect(page.getByTestId("edit-prompt")).toBeVisible()
    await expect(page.getByTestId("field-prompt-path")).toContainText(
      "tasks/flaky/prompt.md"
    )
    await expect(page.getByTestId("field-prompt-path")).toContainText(
      "Not created yet."
    )

    await page.getByTestId("edit-prompt").click()
    await expect(page.getByTestId("prompt-editor")).toBeVisible()
    await page
      .getByTestId("prompt-editor")
      .locator("textarea")
      .fill("Do the flaky work.\n")
    await page.getByTestId("prompt-save").click()
    await expect(page.getByTestId("prompt-editor")).toBeHidden()
    await expect(page.getByTestId("field-prompt-path")).not.toContainText(
      "Not created yet."
    )

    const promptPath = join(
      HOME,
      "workflows",
      "fail-retry",
      "tasks",
      "flaky",
      "prompt.md"
    )
    expect(readFileSync(promptPath, "utf8")).toContain("Do the flaky work.")
    await page.screenshot({ path: "test-results/edit-prompt.png" })
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

  test("switch task kind to agent, save, reload, switch back", async ({
    page,
  }) => {
    await page.goto("/workflows/fail-retry")
    await expect(page.getByTestId("node-flaky")).toBeVisible({
      timeout: 15_000,
    })
    await page.getByTestId("node-flaky").click()
    await expect(page.getByTestId("field-kind")).toBeVisible()

    await page.getByTestId("field-kind").click()
    await page.getByRole("option", { name: "agent" }).click()
    await expect(page.getByTestId("field-cli")).toBeVisible()
    await expect(page.getByTestId("yaml-pane")).toContainText("kind: agent")
    await expect(page.getByTestId("yaml-pane")).toContainText("cli: claude")
    await expect(page.getByTestId("yaml-pane")).not.toContainText(
      "instructions:"
    )
    await expect(page.getByTestId("yaml-pane")).not.toContainText("run:")

    await page.getByTestId("save-button").click()
    await expect(page.getByTestId("save-button")).toBeDisabled({
      timeout: 10_000,
    })

    await page.reload()
    await expect(page.getByTestId("node-flaky")).toBeVisible({
      timeout: 15_000,
    })
    await page.getByTestId("node-flaky").click()
    await expect(page.getByTestId("field-cli")).toBeVisible()
    const onDisk = readFileSync(
      join(HOME, "workflows", "fail-retry", "workflow.yaml"),
      "utf8"
    )
    expect(onDisk).toContain("kind: agent")
    expect(onDisk).toContain("cli: claude")
    expect(onDisk).not.toContain("instructions:")
    expect(onDisk).not.toMatch(/\brun:/)
    expect(onDisk).toContain("retry:")

    await page.getByTestId("field-kind").click()
    await page.getByRole("option", { name: "command" }).click()
    await expect(page.getByTestId("field-run")).toHaveValue("echo ok")
    await expect(page.getByTestId("yaml-pane")).toContainText("run: echo ok")
    await expect(page.getByTestId("yaml-pane")).not.toContainText("cli:")
    await expect(page.getByTestId("yaml-pane")).not.toContainText(
      "instructions:"
    )
    await page.getByTestId("save-button").click()
    await expect(page.getByTestId("save-button")).toBeDisabled({
      timeout: 10_000,
    })
  })

  test("cleared required field shows Inspector error", async ({ page }) => {
    await page.goto("/workflows/diamond")
    await expect(page.getByTestId("node-b")).toBeVisible({
      timeout: 15_000,
    })
    await page.getByTestId("node-b").click()
    await expect(page.getByTestId("field-run")).toBeVisible()

    await page.getByTestId("field-run").fill("")
    await expect(page.getByTestId("field-error-run")).toBeVisible()
    await expect(page.getByTestId("save-button")).toBeDisabled()
    await expect(page.getByTestId("yaml-errors")).toBeVisible()
  })

  test("kind switch keeps other tasks in diamond", async ({ page }) => {
    await page.goto("/workflows/diamond")
    await expect(page.getByTestId("node-a")).toBeVisible({ timeout: 15_000 })
    await page.getByTestId("node-a").click()

    await page.getByTestId("field-kind").click()
    await page.getByRole("option", { name: "agent" }).click()
    await expect(page.getByTestId("field-cli")).toBeVisible()
    await expect(page.getByTestId("yaml-pane")).not.toContainText(
      "instructions:"
    )

    const yaml = await page.getByTestId("yaml-pane").innerText()
    expect(yaml).toContain("id: b")
    expect(yaml).toContain("id: c")
    expect(yaml).toContain("id: d")
    expect(yaml).toMatch(/id: b[\s\S]*?run:/)
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
