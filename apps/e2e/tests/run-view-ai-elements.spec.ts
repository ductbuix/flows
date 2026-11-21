import { expect, test } from "@playwright/test"
import { startRun } from "./helpers"

test.describe("run view AI Elements", () => {
  test("default Terminal, Advanced env/raw, output tree, light and dark", async ({
    page,
    request,
  }) => {
    const runId = await startRun(request, "diamond")
    await page.goto(`/workflows/diamond/runs/${runId}?task=a`)

    for (const id of ["a", "b", "c", "d"]) {
      await expect(page.getByTestId(`task-state-${id}`)).toHaveText(
        "succeeded",
        { timeout: 30_000 }
      )
    }

    await page.getByTestId("task-tab-logs").click()
    await expect(page.getByTestId("task-terminal")).toBeVisible()
    await expect(page.getByTestId("log-output")).toContainText("HELLO_STDOUT")
    await expect(page.getByTestId("advanced-logs")).toHaveCount(0)
    await page.screenshot({
      path: "test-results/run-view-terminal-light.png",
      fullPage: true,
    })

    await page.getByTestId("advanced-switch-control").click()
    await expect(page.getByTestId("advanced-logs")).toBeVisible()
    await expect(page.getByTestId("advanced-env")).toBeVisible()
    await expect(page.getByTestId("advanced-command")).toContainText("HELLO")
    await expect(page.getByTestId("advanced-raw-log")).toContainText(
      "HELLO_STDOUT"
    )
    await page.screenshot({
      path: "test-results/run-view-advanced-light.png",
      fullPage: true,
    })

    await page.getByTestId("task-tab-output").click()
    await expect(page.getByTestId("out-file-tree")).toBeVisible()
    await expect(page.getByTestId("out-file-letter.txt")).toBeVisible()
    await page.screenshot({
      path: "test-results/run-view-file-tree-light.png",
      fullPage: true,
    })

    await page.goto("/settings")
    await page.getByTestId("theme-toggle").getByText("Dark").click()
    await expect(page.locator("html")).toHaveClass(/dark/)
    await page.goto(`/workflows/diamond/runs/${runId}?task=a`)
    await page.getByTestId("task-tab-logs").click()
    await expect(page.getByTestId("task-terminal")).toBeVisible()
    await page.screenshot({
      path: "test-results/run-view-terminal-dark.png",
      fullPage: true,
    })
    await expect(page.getByTestId("advanced-logs")).toBeVisible()
    await page.screenshot({
      path: "test-results/run-view-advanced-dark.png",
      fullPage: true,
    })
  })

  test("failed attempt shows Stack Trace and Plan", async ({
    page,
    request,
  }) => {
    const runId = await startRun(request, "fail-retry")
    await page.goto(`/workflows/fail-retry/runs/${runId}?task=flaky`)
    await expect(page.getByTestId("task-state-flaky")).toHaveText("failed", {
      timeout: 30_000,
    })

    await page.getByTestId("task-tab-attempts").click()
    await expect(page.getByTestId("attempts-plan")).toBeVisible()
    await expect(page.getByTestId("attempts-task")).toBeVisible()
    await expect(page.getByTestId("attempt-stack-1")).toBeVisible()
    await expect(page.getByTestId("attempt-kind-2")).toContainText(/Retry/)
    await page.screenshot({
      path: "test-results/run-view-stack-trace-light.png",
      fullPage: true,
    })
  })

  test("approval uses Confirmation", async ({ page, request }) => {
    const runId = await startRun(request, "gate")
    await page.goto(`/workflows/gate/runs/${runId}?task=hold`)
    await expect(page.getByTestId("task-state-hold")).toHaveText(
      "awaiting_approval",
      { timeout: 15_000 }
    )
    await expect(page.getByTestId("task-confirmation")).toBeVisible()
    await page.screenshot({
      path: "test-results/run-view-confirmation-light.png",
      fullPage: true,
    })
    await page.getByTestId("task-approve").first().click()
    await expect(page.getByTestId("task-state-hold")).toHaveText("succeeded", {
      timeout: 20_000,
    })
  })
})
