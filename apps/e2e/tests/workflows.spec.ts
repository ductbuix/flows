import { expect, test } from "@playwright/test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { e2eHome, fcpRequest, startRun } from "./helpers"

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

/** Click Save and wait until the write finishes (not just pending). */
async function saveAndWait(page: import("@playwright/test").Page) {
  const save = page.getByTestId("workflow-editor-save")
  await expect(save).toBeEnabled()
  await save.click()
  await expect(save).toHaveText("Save")
  await expect(save).toBeDisabled()
}

test.describe("workflows page (BL-179)", () => {
  test("lists workflows, opens editor, creates one", async ({ page }) => {
    await page.goto("/workflows")
    await expect(page.getByTestId("workflows-page")).toBeVisible()
    await expect(page.getByTestId("workflows-new-open")).toBeVisible()
    await expect(page.getByTestId("workflow-diamond")).toBeVisible()
    await screenshotThemes(page, "workflows-page")

    await page.getByTestId("workflow-diamond").click()
    await expect(page.getByTestId("workflow-sheet")).toBeVisible()
    await page.getByTestId("workflow-open-editor").click()
    await expect(page.getByTestId("workflow-editor")).toBeVisible()
    await expect(page.getByTestId("workflow-canvas")).toBeVisible()
    await screenshotThemes(page, "workflow-editor")

    await page.goto("/workflows")
    await page.getByTestId("workflows-new-open").click()
    await expect(page.getByTestId("workflows-new")).toBeVisible()
    await page.getByTestId("workflows-new-name").fill("Ship workflows sdk")
    await page.getByTestId("workflows-new-submit").click()
    await expect(page.getByTestId("workflow-editor")).toBeVisible()
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
    await expect(page.getByTestId("workflow-editor")).toBeVisible()
    await page.getByTestId("workflow-editor-tab-yaml").click()
    const yaml = page.getByTestId("workflow-editor-yaml")
    await expect(yaml).toContainText("id: diamond")
    const current = await yaml.inputValue()
    const withComment = current.replace(
      "goal: e2e node run",
      "# keep me\ngoal: e2e node run"
    )
    await yaml.fill(withComment)
    await saveAndWait(page)
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
    await page.getByTestId("workflow-canvas-fit").click()

    const command = page.getByTestId("canvas-node-command")
    const box = await command.boundingBox()
    expect(box).toBeTruthy()
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
    await page.mouse.down()
    await page.mouse.move(box!.x + box!.width / 2 + 120, box!.y + 40, {
      steps: 8,
    })
    await page.mouse.up()

    await saveAndWait(page)

    const layout = JSON.parse(
      readFileSync(
        join(e2eHome(), "workflows", "diamond", "workflow.layout.json"),
        "utf8"
      )
    ) as { nodes: Record<string, { x: number; y: number }> }
    expect(layout.nodes.build).toBeDefined()
    expect(
      layout.nodes.build.x !== 420 || layout.nodes.build.y !== 80
    ).toBeTruthy()
  })
})

test.describe("workflows.spec.ts › add node", () => {
  test("adds a searched node kind (WF-11)", async ({ page }) => {
    await page.goto("/workflows/diamond")
    await expect(page.getByTestId("workflow-canvas")).toBeVisible()
    await page.getByTestId("flow-add-node").click()
    await page.getByTestId("flow-add-node-search").fill("llm")
    await page.getByTestId("flow-add-kind-llm").click()
    await expect(page.getByTestId("canvas-node-llm")).toBeVisible()
    await saveAndWait(page)
    const onDisk = readFileSync(
      join(e2eHome(), "workflows", "diamond", "workflow.yaml"),
      "utf8"
    )
    expect(onDisk).toContain("kind: llm")
  })
})

test.describe("workflows.spec.ts › node settings", () => {
  test("edits time limit and retries (WF-12)", async ({ page }) => {
    await page.goto("/workflows/node-settings-e2e")
    await page.getByTestId("workflow-canvas-fit").click()
    await page.getByTestId("canvas-node-command").click()
    await page.getByTestId("node-open-settings").click({ force: true })
    await expect(page.getByTestId("node-settings")).toBeVisible()
    await page.getByTestId("node-settings-timeout").click()
    await page.getByRole("option", { name: "30 min" }).click()
    await page.getByTestId("node-settings-retry").click()
    await page.getByRole("option", { name: "2 retries" }).click()
    await saveAndWait(page)
    const onDisk = readFileSync(
      join(e2eHome(), "workflows", "node-settings-e2e", "workflow.yaml"),
      "utf8"
    )
    expect(onDisk).toMatch(/timeout:\s*1800/)
    expect(onDisk).toMatch(/max:\s*2/)
  })
})

test.describe("workflows.spec.ts › undo redo", () => {
  test("undo and redo cover add node (WF-13)", async ({ page }) => {
    await page.goto("/workflows/diamond")
    await expect(page.getByTestId("workflow-canvas-fit")).toBeVisible()
    await page.getByTestId("flow-add-node").click()
    await page.getByTestId("flow-add-kind-approval").click()
    await expect(page.getByTestId("canvas-node-approval")).toBeVisible()
    await expect(page.getByTestId("workflow-canvas-undo")).toBeEnabled({
      timeout: 5000,
    })
    await page.getByTestId("workflow-canvas-undo").click()
    await expect(page.getByTestId("canvas-node-approval")).toHaveCount(0)
    await page.getByTestId("workflow-canvas-redo").click()
    await expect(page.getByTestId("canvas-node-approval")).toBeVisible()
  })
})

test.describe("workflows.spec.ts › trigger inputs", () => {
  test("adds a trigger input (WF-14)", async ({ page }) => {
    // Own workflow so later diamond start-run tests are not blocked by a
    // required input left on disk.
    await page.goto("/workflows/node-run-ok-light")
    await page.getByTestId("workflow-canvas-fit").click()
    await page.getByTestId("canvas-node-trigger").click()
    await expect(page.getByTestId("node-open-settings")).toBeVisible()
    await page.getByTestId("node-open-settings").click()
    await expect(page.getByTestId("node-settings")).toBeVisible()
    await expect(page.getByTestId("trigger-inputs")).toBeVisible()
    await page.getByTestId("trigger-input-draft").fill("ticket")
    await page.getByTestId("trigger-input-add").click()
    await expect(page.getByText("ticket")).toBeVisible()
    await saveAndWait(page)
    const onDisk = readFileSync(
      join(e2eHome(), "workflows", "node-run-ok-light", "workflow.yaml"),
      "utf8"
    )
    expect(onDisk).toContain("ticket")
  })
})

test.describe("workflows.spec.ts › step connectors", () => {
  test("picks connectors and skills on an agent (WF-15)", async ({ page }) => {
    await page.goto("/workflows/node-canvas")
    await expect(page.getByTestId("canvas-node-agent")).toBeVisible()
    await page.getByTestId("workflow-canvas-fit").click()
    await page.getByTestId("step-connectors").click()
    await expect(page.getByTestId("node-settings")).toBeVisible()
    await page.getByTestId("pick-Connectors").locator("input").fill("github")
    await page.getByTestId("pick-item-github-cli").click()
    // Prefer commit-style: skills.spec may have uninstalled write-tests.
    await page.getByTestId("pick-Skills").locator("input").fill("commit")
    await page.getByTestId("pick-item-commit-style").click()
    await saveAndWait(page)
    const onDisk = readFileSync(
      join(e2eHome(), "workflows", "node-canvas", "workflow.yaml"),
      "utf8"
    )
    expect(onDisk).toContain("github-cli")
    expect(onDisk).toContain("commit-style")
  })
})

test.describe("workflows.spec.ts › model row", () => {
  test("shows model row on llm and changes cli (WF-16)", async ({ page }) => {
    await page.goto("/workflows/node-llm-light")
    await expect(page.getByTestId("model-row")).toBeVisible()
    await page.getByTestId("model-row-cli").click()
    await page.getByRole("option", { name: "Cursor" }).click()
    await saveAndWait(page)
    const onDisk = readFileSync(
      join(e2eHome(), "workflows", "node-llm-light", "workflow.yaml"),
      "utf8"
    )
    expect(onDisk).toContain("cli: cursor")
  })
})

test.describe("workflows.spec.ts › node actions", () => {
  test("duplicates and deletes a node (WF-17)", async ({ page }) => {
    await page.goto("/workflows/diamond")
    await page.getByTestId("workflow-canvas-fit").click()
    const command = page.getByTestId("canvas-node-command")
    await command.click()
    // evaluate: toolbar remounts on mutate and stalls Playwright's click.
    // Duplicate offsets +40,+40 under a wide card — don't click .last().
    await page.getByTestId("node-duplicate").evaluate((el: HTMLElement) => {
      el.click()
    })
    await expect(command).toHaveCount(2)
    await page.getByTestId("node-delete").evaluate((el: HTMLElement) => {
      el.click()
    })
    await expect(command).toHaveCount(1)
  })
})

test.describe("workflows.spec.ts › validate", () => {
  test("blocks save when yaml is invalid", async ({ page }) => {
    await page.goto("/workflows/diamond")
    await page.getByTestId("workflow-editor-tab-yaml").click()
    const yaml = page.getByTestId("workflow-editor-yaml")
    await yaml.fill("id: diamond\nnodes: [{ id: x, kind: nope }]\n")
    await page.getByTestId("workflow-editor-save").click()
    await expect(page.getByTestId("workflow-editor-validation")).toBeVisible()
  })
})

test.describe("workflows.spec.ts › sheet", () => {
  test("opens sheet from a row (WF-04)", async ({ page }) => {
    await page.goto("/workflows")
    await page.getByTestId("mock-workflow-diamond").click()
    await expect(page.getByTestId("workflow-sheet")).toBeVisible()
    await expect(page.getByTestId("workflow-open-editor")).toBeVisible()
    await expect(page.getByTestId("sheet-inputs")).toBeVisible()
    await expect(page.getByTestId("workflow-start")).toBeVisible()
  })
})

test.describe("workflows.spec.ts › sheet inputs", () => {
  test("edits inputs a card supplies (WF-06)", async ({ page }) => {
    await page.goto("/workflows")
    await page.getByTestId("mock-workflow-node-start-run").click()
    const sheet = page.getByTestId("workflow-sheet")
    await expect(sheet).toBeVisible()
    await expect(sheet.getByTestId("sheet-inputs")).toContainText("ticket")
    await sheet.getByTestId("trigger-input-draft").fill("repo")
    await sheet.getByTestId("trigger-input-add").click()
    await expect(sheet.getByTestId("sheet-inputs")).toContainText("repo")
    await page.keyboard.press("Escape")
    await page.getByTestId("mock-workflow-node-start-run").click()
    await expect(page.getByTestId("sheet-inputs")).toContainText("repo")
  })
})

test.describe("workflows.spec.ts › sheet runs", () => {
  test("lists runs by card after a start (WF-07)", async ({ page }) => {
    await page.goto("/workflows")
    await page.getByTestId("mock-workflow-diamond").click()
    const sheet = page.getByTestId("workflow-sheet")
    await expect(sheet.getByTestId("sheet-runs-empty")).toBeVisible()
    await sheet.getByTestId("sheet-start-card").click()
    await page.getByRole("option", { name: /Fix flaky login/i }).click()
    await sheet.getByTestId("workflow-start").click()
    await expect(page.getByTestId("mock-workflow-editor")).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByTestId("flow-run-banner")).toBeVisible({
      timeout: 15_000,
    })
    await page.goto("/workflows")
    await page.getByTestId("mock-workflow-diamond").click()
    await expect(page.getByTestId("sheet-runs-list")).toBeVisible({
      timeout: 15_000,
    })
  })
})

test.describe("workflows.spec.ts › sheet start", () => {
  test("starts a run for a card from the sheet (WF-08)", async ({ page }) => {
    await page.goto("/workflows")
    await page.getByTestId("mock-workflow-diamond").click()
    const sheet = page.getByTestId("workflow-sheet")
    await sheet.getByTestId("sheet-start-card").click()
    await page.getByRole("option", { name: /Fix flaky login/i }).click()
    await sheet.getByTestId("workflow-start").click()
    await expect(page.getByTestId("flow-run-bar")).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByTestId("flow-run-banner")).toBeVisible({
      timeout: 20_000,
    })
    await expect(page).toHaveURL(/run=/)
  })
})

test.describe("workflows.spec.ts › canvas run bar", () => {
  test("selects a card and starts a run (RN-02)", async ({ page }) => {
    await page.goto("/workflows/diamond")
    await expect(page.getByTestId("flow-run-bar")).toBeVisible()
    await page.getByTestId("flow-run-card").click()
    await page.getByRole("option", { name: /Fix flaky login/i }).click()
    await expect(page.getByTestId("flow-start-run")).toBeEnabled()
    await page.getByTestId("flow-start-run").click()
    await expect(page.getByTestId("flow-run-banner")).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByTestId("flow-run-select")).toBeVisible()
    await expect(
      page.locator('[data-testid="canvas-node-command"]')
    ).toBeVisible()
  })

  test("offers Retry on a failed node", async ({ page }) => {
    test.setTimeout(90_000)
    const runId = await startRun("node-run-fail-light")
    await expect
      .poll(
        async () => {
          const got = (await fcpRequest("run/get", { id: runId })) as {
            status: string
          }
          return got.status
        },
        { timeout: 45_000 }
      )
      .toBe("failed")
    await page.goto(`/workflows/node-run-fail-light?run=${runId}`)
    await expect(page.getByTestId("flow-run-banner")).toContainText(/Failed/i, {
      timeout: 15_000,
    })
    const retry = page.getByTestId("node-retry-build")
    await expect(retry).toBeVisible({ timeout: 15_000 })
    await retry.click({ force: true })
    await expect(page.getByTestId("flow-run-banner")).toBeVisible()
  })
})
