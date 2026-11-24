import { expect, test } from "@playwright/test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { cancelLiveRuns, e2eHome, fcpRequest, startRun } from "./helpers"

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

test.describe("workflows page (BL-179 / BL-216)", () => {
  test("list", async ({ page }) => {
    await page.goto("/workflows")
    await expect(page.getByTestId("workflows-page")).toBeVisible()
    await expect(page.getByTestId("workflows-new-open")).toBeVisible()
    await expect(page.getByTestId("workflow-diamond")).toBeVisible()
    await expect(page.getByTestId("workflows-search")).toBeVisible()
    await screenshotThemes(page, "workflows-page")
  })

  test("new", async ({ page }) => {
    const name = `Ship wf ${Date.now()}`
    await page.goto("/workflows")
    await page.getByTestId("workflows-new-open").click()
    await expect(page.getByTestId("workflows-new")).toBeVisible()
    await page.getByTestId("workflows-new-name").fill(name)
    await page.getByTestId("workflows-new-submit").click()
    await expect(page.getByTestId("workflow-editor")).toBeVisible()
    await page.getByTestId("workflow-editor-tab-yaml").click()
    await expect(page.getByTestId("workflow-editor-yaml")).toContainText(
      "ship-wf-"
    )
  })

  test("open editor", async ({ page }) => {
    await page.goto("/workflows")
    await page.getByTestId("workflow-diamond").click()
    await expect(page.getByTestId("workflow-sheet")).toBeVisible()
    await page.getByTestId("workflow-open-editor").click()
    await expect(page.getByTestId("workflow-editor")).toBeVisible()
    await expect(page.getByTestId("workflow-canvas")).toBeVisible()
    await screenshotThemes(page, "workflow-editor")
  })

  test("rename delete", async ({ page }) => {
    const stamp = Date.now()
    const name = `Rename me ${stamp}`
    await page.goto("/workflows")
    await page.getByTestId("workflows-new-open").click()
    await page.getByTestId("workflows-new-name").fill(name)
    await page.getByTestId("workflows-new-submit").click()
    await expect(page.getByTestId("workflow-editor")).toBeVisible()
    await page.goto("/workflows")
    const row = page.locator(`[data-testid^="workflow-rename-me-"]`).first()
    await expect(row).toBeVisible()
    const id = (await row.getAttribute("data-testid"))!.replace(
      /^workflow-/,
      ""
    )
    await page.getByRole("button", { name: `Actions for ${name}` }).click()
    await page.getByRole("menuitem", { name: "Rename" }).click()
    await expect(page.getByTestId("workflows-new")).toBeVisible()
    const renamed = `Renamed ${stamp}`
    await page.getByTestId("workflows-new-name").fill(renamed)
    await page.getByTestId("workflows-new-submit").click()
    await expect(
      page.getByRole("button", { name: `Actions for ${renamed}` })
    ).toBeVisible({ timeout: 10_000 })
    await page.getByRole("button", { name: `Actions for ${renamed}` }).click()
    await page.getByRole("menuitem", { name: "Delete" }).click()
    await page.getByTestId("confirm-ok").click()
    await expect(page.getByTestId(`workflow-${id}`)).toHaveCount(0, {
      timeout: 10_000,
    })
  })
})

test.describe("workflows.spec.ts › editor yaml", () => {
  test("editor yaml", async ({ page }) => {
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
  test("canvas", async ({ page }) => {
    await page.goto("/workflows/diamond")
    await expect(page.getByTestId("workflow-canvas")).toBeVisible()
    await expect(page.getByTestId("canvas-node-trigger")).toBeVisible()
    await expect(page.getByTestId("canvas-node-command")).toBeVisible()
    await expect(page.getByTestId("canvas-node-output")).toBeVisible()
    await page.getByTestId("workflow-canvas-fit").click()

    const command = page.getByTestId("canvas-node-command")
    const box = await command.boundingBox()
    expect(box).toBeTruthy()
    // Grab the header: the card body is an editable field (nodrag).
    await page.mouse.move(box!.x + box!.width / 2, box!.y + 8)
    await page.mouse.down()
    await page.mouse.move(box!.x + box!.width / 2 + 120, box!.y + 48, {
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
  test("add node", async ({ page }) => {
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
  test("node settings", async ({ page }) => {
    await page.goto("/workflows/node-settings-e2e")
    await page.getByTestId("workflow-canvas-fit").click()
    await page.getByTestId("canvas-node-command").click()
    // evaluate: toolbar remounts on select and stalls Playwright's click.
    await page.getByTestId("node-open-settings").evaluate((el: HTMLElement) => {
      el.click()
    })
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
  test("undo redo", async ({ page }) => {
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

test.describe("workflows.spec.ts › canvas edit", () => {
  test("trigger has no settings; edit, wire and notify inline", async ({
    page,
  }) => {
    await page.goto("/workflows/canvas-edit-e2e")
    await page.getByTestId("canvas-node-trigger").click()
    await expect(page.getByTestId("node-open-settings")).toHaveCount(0)

    const instructions = page
      .getByTestId("canvas-node-llm")
      .getByTestId("node-field-prompt")
    await expect(instructions).toHaveValue("Plan it.\n")
    await instructions.fill("Plan the ticket.")
    await instructions.blur()

    await page
      .getByTestId("canvas-node-trigger")
      .locator('.react-flow__handle[data-handleid="text"]')
      .dragTo(
        page
          .getByTestId("canvas-node-llm")
          .locator('.react-flow__handle-left[data-handleid="text"]')
      )
    await page.getByTestId("output-channel-system").click()
    await saveAndWait(page)

    const dir = join(e2eHome(), "workflows", "canvas-edit-e2e")
    const onDisk = readFileSync(join(dir, "workflow.yaml"), "utf8")
    expect(onDisk).toContain("{ from: start, to: plan }")
    expect(onDisk).toContain("channel: system")
    await expect
      .poll(() => readFileSync(join(dir, "nodes", "plan", "prompt.md"), "utf8"))
      .toBe("Plan the ticket.")
  })
})

test.describe("workflows.spec.ts › step connectors", () => {
  test("step connectors", async ({ page }) => {
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
  test("model row", async ({ page }) => {
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
  test("node actions", async ({ page }) => {
    await page.goto("/workflows/diamond")
    await page.getByTestId("workflow-canvas-fit").click()
    const command = page.getByTestId("canvas-node-command")
    // Header: the body is an editable field and may sit under a neighbour.
    await command.getByText("Command").click()
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
  test("sheet", async ({ page }) => {
    await page.goto("/workflows")
    await page.getByTestId("workflow-diamond").click()
    await expect(page.getByTestId("workflow-sheet")).toBeVisible()
    await expect(page.getByTestId("workflow-open-editor")).toBeVisible()
    await expect(page.getByTestId("sheet-inputs")).toBeVisible()
    await expect(page.getByTestId("workflow-start")).toBeVisible()
  })
})

test.describe("workflows.spec.ts › sheet inputs", () => {
  test("sheet inputs", async ({ page }) => {
    await page.goto("/workflows")
    await page.getByTestId("workflow-node-start-run").click()
    const sheet = page.getByTestId("workflow-sheet")
    await expect(sheet).toBeVisible()
    await expect(sheet.getByTestId("sheet-inputs")).toContainText("ticket")
    await sheet.getByTestId("trigger-input-draft").fill("repo")
    await sheet.getByTestId("trigger-input-add").click()
    await expect(sheet.getByTestId("sheet-inputs")).toContainText("repo")
    await page.keyboard.press("Escape")
    await page.getByTestId("workflow-node-start-run").click()
    await expect(page.getByTestId("sheet-inputs")).toContainText("repo")
  })
})

test.describe("workflows.spec.ts › sheet runs", () => {
  test("sheet runs", async ({ page }) => {
    // Diamond is shared across specs; do not require an empty runs list.
    await cancelLiveRuns("diamond")
    await page.goto("/workflows")
    await page.getByTestId("workflow-diamond").click()
    const sheet = page.getByTestId("workflow-sheet")
    await sheet.getByTestId("sheet-start-card").click()
    await page.getByRole("option", { name: /Fix flaky login/i }).click()
    await sheet.getByTestId("workflow-start").click()
    await expect(page.getByTestId("workflow-editor")).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByTestId("flow-run-banner")).toBeVisible({
      timeout: 15_000,
    })
    await page.goto("/workflows")
    await page.getByTestId("workflow-diamond").click()
    await expect(page.getByTestId("sheet-runs-list")).toBeVisible({
      timeout: 15_000,
    })
  })
})

test.describe("workflows.spec.ts › sheet start", () => {
  test("sheet start", async ({ page }) => {
    await page.goto("/workflows")
    await page.getByTestId("workflow-diamond").click()
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
  test("canvas run bar", async ({ page }) => {
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
    await cancelLiveRuns("node-run-fail-light")
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
  test("node logs button and popup", async ({ page }) => {
    test.setTimeout(90_000)
    await cancelLiveRuns("node-run-fail-light")
    const runId = await startRun("node-run-fail-light")
    await expect
      .poll(
        async () =>
          (
            (await fcpRequest("run/get", { id: runId })) as {
              status: string
            }
          ).status,
        { timeout: 45_000 }
      )
      .toBe("failed")
    await page.goto(`/workflows/node-run-fail-light?run=${runId}`)
    const logs = page.getByTestId("node-logs-build")
    await expect(logs).toBeVisible({ timeout: 15_000 })
    // Trigger and output run nothing locally: no button.
    await expect(page.locator('[data-testid^="node-logs-"]')).toHaveCount(1)

    for (const size of [
      { width: 1280, height: 800 },
      { width: 375, height: 700 },
    ]) {
      await page.setViewportSize(size)
      await logs.click({ force: true })
      const dialog = page.getByTestId("node-log-dialog")
      await expect(dialog).toBeVisible()
      await expect(page.getByTestId("node-log-terminal")).toContainText(
        "echo broken"
      )
      await expect(page.getByTestId("node-log-terminal")).toContainText(
        "broken"
      )
      const entries = page.getByTestId("node-log-entries").locator("> li")
      await expect(entries.first().locator("time")).toBeVisible()
      const box = await dialog.boundingBox()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(size.width)
      await page.keyboard.press("Escape")
      await expect(dialog).toHaveCount(0)
    }
  })
})
