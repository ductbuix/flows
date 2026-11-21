import { expect, test } from "@playwright/test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { disableAdvanced, enableAdvanced, e2eHome } from "./helpers"

const API = process.env.PW_API_BASE ?? "http://127.0.0.1:8787"

test.describe("model and effort UI (BL-026)", () => {
  test("workflow defaults, custom id, and lone when judge", async ({
    page,
  }) => {
    await page.goto("/workflows/judge-model")
    await expect(page.getByTestId("graph-canvas")).toBeVisible({
      timeout: 15_000,
    })
    await disableAdvanced(page)

    await expect(page.getByTestId("agent-defaults")).toBeVisible()
    await expect(
      page.getByTestId("agent-defaults").getByTestId("field-model").first()
    ).toBeVisible()

    const claudeModel = page
      .getByTestId("agent-defaults")
      .getByTestId("field-model")
      .first()
    await claudeModel.click()
    await page.getByRole("menuitemradio", { name: "Custom…" }).click()
    await page.getByTestId("field-model-custom").fill("my-custom-model")
    await page.keyboard.press("Escape")
    await expect(claudeModel).toContainText("my-custom-model")

    await page.getByTestId("node-gated").click()
    await expect(page.getByTestId("when-judge-fields")).toBeVisible()
    await expect(page.getByTestId("when-field-model")).toBeVisible()

    await page.getByTestId("when-field-model").click()
    await page.getByRole("menuitemradio", { name: "Sonnet" }).click()
    await expect(page.getByRole("menu")).toHaveCount(0)
    await expect(page.getByTestId("when-field-model")).toContainText("Sonnet")
    await page.getByTestId("when-field-effort").click()
    await page.getByRole("menuitemradio", { name: "High", exact: true }).click()
    await expect(page.getByRole("menu")).toHaveCount(0)
    await expect(page.getByTestId("when-field-effort")).toContainText("High")

    await enableAdvanced(page)
    await expect(page.getByTestId("yaml-pane")).toContainText("model: sonnet")
    await expect(page.getByTestId("yaml-pane")).toContainText("effort: high")
    await expect(page.getByTestId("yaml-pane")).toContainText("my-custom-model")

    await page.getByTestId("save-button").click()
    await expect(page.getByTestId("save-button")).toBeDisabled({
      timeout: 10_000,
    })

    const onDisk = readFileSync(
      join(e2eHome(), "workflows", "judge-model", "workflow.yaml"),
      "utf8"
    )
    expect(onDisk).toContain("model: sonnet")
    expect(onDisk).toContain("effort: high")
    expect(onDisk).toContain("my-custom-model")

    await page.screenshot({
      path: "test-results/judge-model-effort-light.png",
      fullPage: true,
    })
  })

  test("attempt row shows resolved model, effort, and source", async ({
    page,
    request,
  }) => {
    await request.put(`${API}/api/trust`, { data: { grant: "always" } })
    const res = await request.post(`${API}/api/workflows/agent-model/runs`, {
      data: { requestId: crypto.randomUUID(), trustGrant: "once" },
    })
    expect(res.ok()).toBeTruthy()
    const { runId } = (await res.json()) as { runId: string }

    await page.goto(`/workflows/agent-model/runs/${runId}?task=hello`)
    await page.getByTestId("task-tab-attempts").click()
    await expect(page.getByTestId("attempt-model-1")).toContainText("haiku", {
      timeout: 30_000,
    })
    await expect(page.getByTestId("attempt-model-1")).toContainText("low")
    await expect(page.getByTestId("attempt-model-1")).toContainText("via task")

    await page.screenshot({
      path: "test-results/attempt-model-effort-light.png",
      fullPage: true,
    })
  })
})
