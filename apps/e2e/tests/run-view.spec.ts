import { expect, test } from "@playwright/test"
import { startRun } from "./helpers"

test.describe("run view", () => {
  test("diamond run shows live success, logs, summary, and keeps selection in graph", async ({
    page,
    request,
  }) => {
    const runId = await startRun(request, "diamond")

    await page.goto(`/workflows/diamond/runs/${runId}?task=a`)

    await expect(page.getByTestId("run-status")).toBeVisible()
    await expect(page.getByTestId("ws-status")).toBeVisible()
    // macOS sandbox-exec applies; badge only shows when unrestricted.
    await expect(page.getByTestId("sandbox-badge")).toHaveCount(0)

    for (const id of ["a", "b", "c", "d"]) {
      await expect(page.getByTestId(`task-state-${id}`)).toHaveText(
        "succeeded",
        { timeout: 30_000 }
      )
    }
    await expect(page.getByTestId("run-status")).toHaveText("succeeded")

    await page.getByTestId("task-tab-logs").click()
    await expect(page.getByTestId("log-output")).toContainText("HELLO_STDOUT", {
      timeout: 10_000,
    })

    await page.getByTestId("task-tab-summary").click()
    const summary = page.getByTestId("summary-markdown")
    await expect(summary.getByRole("heading", { name: "Report" })).toBeVisible()
    await expect(summary.locator("table")).toBeVisible()

    await page.getByTestId("run-view-graph").click()
    await expect(page).toHaveURL(/view=graph/)
    await expect(page).toHaveURL(/task=a/)
    await expect(page.getByTestId("task-node-a")).toBeVisible()
    await expect(page.getByTestId("run-graph")).toBeVisible()
  })

  test("failed retry shows Retry attempt badge", async ({ page, request }) => {
    const runId = await startRun(request, "fail-retry")
    await page.goto(`/workflows/fail-retry/runs/${runId}?task=flaky`)

    await expect(page.getByTestId("task-state-flaky")).toHaveText("failed", {
      timeout: 30_000,
    })

    await page.getByTestId("task-tab-attempts").click()
    await expect(page.getByTestId("attempt-kind-2")).toContainText(/Retry/)
  })

  test("short timeout fails with visible timeout reason", async ({
    page,
    request,
  }) => {
    const runId = await startRun(request, "timeout-short")
    await page.goto(`/workflows/timeout-short/runs/${runId}?task=slow`)

    await expect(page.getByTestId("task-state-slow")).toHaveText("failed", {
      timeout: 30_000,
    })
    await expect(page.getByTestId("run-status")).toHaveText("failed")

    await page.getByTestId("task-tab-attempts").click()
    await expect(page.getByTestId("attempt-reason-1")).toHaveText("timeout")
  })
})
