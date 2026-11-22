import { expect, test } from "@playwright/test"

// Judge in check mode: tests a named answer, no model call (BL-101). The stub
// `claude` answers risk high and score 3 for the LLM step.
test.use({ viewport: { width: 1440, height: 900 } })

const API = `http://127.0.0.1:${process.env.PW_API_PORT ?? "8787"}`

for (const theme of ["light", "dark"] as const) {
  test(`a check Judge shows its test and takes Yes on the canvas (${theme})`, async ({
    page,
  }, info) => {
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme)
    await page.goto(`/workflows/node-judge-check-${theme}?tab=editor`)
    await expect(page.getByTestId("canvas")).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId("judge-mode")).toContainText("Check")
    await expect(page.getByTestId("judge-check-field")).toHaveValue("risk")
    await expect(page.getByTestId("judge-check-operator")).toContainText("=")
    await expect(page.getByTestId("judge-check-value")).toHaveValue("high")
    // A check has no rule box and no CLI pills.
    await expect(page.getByTestId("judge-rule")).toHaveCount(0)
    await page.screenshot({ path: info.outputPath(`node-judge-check-${theme}.png`) })

    await page.getByTestId("canvas-run").click()
    await page.getByTestId("start-run-submit").click()
    await page.getByTestId("trust-once").click()

    await expect(page.getByTestId("node-status-check")).toHaveText("Done", {
      timeout: 20_000,
    })
    await expect(page.getByTestId("node-verdict-check")).toHaveText("Yes")
    await expect(page.getByTestId("node-status-approved")).toHaveText("Done", {
      timeout: 20_000,
    })
    await expect(page.getByTestId("node-status-rejected")).toHaveText("Skipped")
    await page.screenshot({
      path: info.outputPath(`node-judge-check-run-${theme}.png`),
    })
  })

  test(`the mode and the operator are edited on the card (${theme})`, async ({
    page,
  }, info) => {
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme)
    await page.goto(`/workflows/node-judge-check-${theme}-view?tab=editor`)
    await expect(page.getByTestId("canvas")).toBeVisible({ timeout: 15_000 })

    await page.getByTestId("judge-check-operator").click()
    await page.getByRole("option", { name: "set", exact: true }).click()
    // `set` takes no value.
    await expect(page.getByTestId("judge-check-value")).toHaveCount(0)
    await page.screenshot({ path: info.outputPath(`node-judge-check-set-${theme}.png`) })

    await page.getByTestId("judge-mode").click()
    await page.getByRole("option", { name: "Rule (model)" }).click()
    await expect(page.getByTestId("judge-rule")).toBeVisible()
    await expect(page.getByTestId("judge-check")).toHaveCount(0)
    await page.screenshot({ path: info.outputPath(`node-judge-rule-${theme}.png`) })

    await page.getByTestId("node-save").click()
    await expect(page.getByTestId("node-save")).toBeDisabled()
    const wf = (await (
      await page.request.get(`${API}/api/workflows/node-judge-check-${theme}-view`)
    ).json()) as { yaml: string }
    expect(wf.yaml).not.toContain("mode: check")
    expect(wf.yaml).not.toContain("check:")
    expect(wf.yaml).toContain("cli: claude")
  })
}
