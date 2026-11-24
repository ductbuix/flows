import { expect, test } from "@playwright/test"

// Named answers on LLM steps and {{name}} templates (BL-085). The stub
// `claude` answers a JSON block when the prompt asks for answers.
test.use({ viewport: { width: 1440, height: 900 } })

const API = `http://127.0.0.1:${process.env.PW_API_PORT ?? "8787"}`

for (const theme of ["light", "dark"] as const) {
  test(`the Sheet edits answers and Save writes them (${theme})`, async ({
    page,
  }, info) => {
    const id = `node-answers-sheet-${theme}`
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme)
    await page.goto(`/workflows/${id}?tab=editor`)
    await expect(page.getByTestId("canvas")).toBeVisible({ timeout: 15_000 })

    await page.getByTestId("node-settings-assess").click()
    await expect(page.getByTestId("answer-row-risk")).toContainText("low, high")
    await expect(page.getByTestId("answer-row-score")).toContainText("number")
    await page.screenshot({
      path: info.outputPath(`node-answers-sheet-${theme}.png`),
    })

    await page.getByTestId("answer-add").click()
    await page.getByTestId("answer-edit-name").fill("ready")
    await page.getByTestId("answer-edit-type").click()
    await page.getByRole("option", { name: "Yes or no" }).click()
    await page.screenshot({
      path: info.outputPath(`node-answers-edit-${theme}.png`),
    })
    await page.getByTestId("answer-edit-done").click()
    await expect(page.getByTestId("answer-row-ready")).toContainText(
      "yes or no"
    )

    // A duplicate name cannot be saved.
    await page.getByTestId("answer-add").click()
    await page.getByTestId("answer-edit-name").fill("risk")
    await expect(page.getByTestId("answer-edit-done")).toBeDisabled()
    await page.keyboard.press("Escape")

    await page.getByTestId("answer-remove-score").click()
    await expect(page.getByTestId("answer-row-score")).toHaveCount(0)
    await page.keyboard.press("Escape")
    await page.getByTestId("node-save").click()
    await expect(page.getByTestId("node-save")).toBeDisabled()
    const wf = (await (
      await page.request.get(`/api/workflows/${id}`)
    ).json()) as {
      yaml: string
    }
    expect(wf.yaml).toContain("name: ready")
    expect(wf.yaml).toContain("type: yesno")
    expect(wf.yaml).not.toContain("name: score")
  })

  test(`the step detail shows the answer (${theme})`, async ({
    page,
    request,
  }, info) => {
    const id = `node-answers-${theme}`
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme)
    const res = await request.post(`${API}/api/workflows/${id}/runs`, {
      data: { requestId: crypto.randomUUID() },
    })
    expect(res.ok()).toBeTruthy()
    const { runId } = (await res.json()) as { runId: string }

    await page.goto(`/runs/${runId}`)
    await expect(page.getByTestId("step-table")).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByTestId("step-state-show-1")).toHaveText(
      "succeeded",
      {
        timeout: 20_000,
      }
    )
    await page.getByTestId("step-row-assess-1").click()
    await expect(page.getByTestId("task-answer-risk")).toContainText("high")
    await expect(page.getByTestId("task-answer-score")).toContainText("3")
    await page.screenshot({
      path: info.outputPath(`node-answers-run-${theme}.png`),
    })
  })

  test(`a later step gets the answers filled into its prompt (${theme})`, async ({
    page,
  }, info) => {
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme)
    await page.goto(`/workflows/node-answers-${theme}?tab=editor`)
    await expect(page.getByTestId("canvas")).toBeVisible({ timeout: 15_000 })
    await page.getByTestId("canvas-run").click()
    await page.getByTestId("start-run-submit").click()
    await page.getByTestId("trust-once").click()
    await expect(page.getByTestId("node-status-show")).toHaveText("Done", {
      timeout: 20_000,
    })
    await expect(page.getByTestId("node-result-show")).toContainText(
      "Summary: Risk is high, score 3."
    )
    await page.screenshot({
      path: info.outputPath(`node-answers-graph-${theme}.png`),
    })
  })
}
