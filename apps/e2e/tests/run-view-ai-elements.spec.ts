import { expect, test } from "@playwright/test"
import { startRun } from "./helpers"

test.describe("run view AI Elements", () => {
  test("Terminal, Environment, output tree, light and dark", async ({
    page,
    request,
  }) => {
    const runId = await startRun(request, "diamond")
    await page.goto(`/runs/${runId}?task=a`)

    for (const id of ["a", "b", "c", "d"]) {
      await expect(page.getByTestId(`task-state-${id}`)).toHaveText(
        "succeeded",
        { timeout: 30_000 }
      )
    }

    await page.getByTestId("task-tab-terminal").click()
    await expect(page.getByTestId("task-terminal")).toBeVisible()
    await expect(page.getByTestId("log-output")).toContainText("HELLO_STDOUT")
    await page.screenshot({
      path: "test-results/run-view-terminal-light.png",
      fullPage: true,
    })

    await page.getByTestId("task-tab-environment").click()
    await expect(page.getByTestId("task-environment")).toBeVisible()
    await expect(page.getByTestId("task-env-vars")).toBeVisible()
    await expect(page.getByTestId("task-env-vars")).toContainText("PORT")
    await expect(page.getByTestId("task-env-vars")).toContainText(
      "FLOWS_PORT_BASE"
    )
    await expect(page.getByTestId("task-env-vars")).toContainText(
      "npm_config_cache"
    )
    await expect(page.getByTestId("task-env-command")).toContainText("HELLO")
    await expect(page.getByTestId("task-env-raw-log")).toContainText(
      "HELLO_STDOUT"
    )
    await page.screenshot({
      path: "test-results/run-view-environment-light.png",
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
    await page.goto(`/runs/${runId}?task=a&tab=terminal`)
    await expect(page.getByTestId("task-terminal")).toBeVisible()
    await page.screenshot({
      path: "test-results/run-view-terminal-dark.png",
      fullPage: true,
    })
    await page.getByTestId("task-tab-environment").click()
    await expect(page.getByTestId("task-environment")).toBeVisible()
    await page.screenshot({
      path: "test-results/run-view-environment-dark.png",
      fullPage: true,
    })
  })

  test("failed attempt shows Stack Trace, Plan, and failure Alert", async ({
    page,
    request,
  }) => {
    const runId = await startRun(request, "fail-retry")
    await page.goto(`/runs/${runId}?task=flaky`)
    await expect(page.getByTestId("task-state-flaky")).toHaveText("failed", {
      timeout: 30_000,
    })

    await expect(page.getByTestId("run-failed-alert")).toBeVisible()
    await expect(page.getByTestId("run-failed-task")).toHaveText("flaky")
    await page.screenshot({
      path: "test-results/run-view-failed-light.png",
      fullPage: true,
    })

    await page.getByTestId("run-failed-terminal-link").click()
    await expect(page).toHaveURL(/tab=terminal/)
    await expect(page).toHaveURL(/task=flaky/)
    // fail-retry writes no stdout; Terminal tab still opens (empty or log).
    await expect(
      page
        .getByTestId("task-terminal")
        .or(page.getByTestId("task-terminal-empty"))
    ).toBeVisible()

    await page.getByTestId("task-tab-attempts").click()
    await expect(page.getByTestId("attempts-plan")).toBeVisible()
    await expect(page.getByTestId("attempts-task")).toBeVisible()
    await expect(page.getByTestId("attempt-stack-1")).toBeVisible()
    await expect(page.getByTestId("attempt-kind-2")).toContainText(/Retry/)
    await page.screenshot({
      path: "test-results/run-view-stack-trace-light.png",
      fullPage: true,
    })

    await page.goto("/settings")
    await page.getByTestId("theme-toggle").getByText("Dark").click()
    await expect(page.locator("html")).toHaveClass(/dark/)
    await page.goto(`/runs/${runId}?task=flaky`)
    await expect(page.getByTestId("run-failed-alert")).toBeVisible()
    await page.screenshot({
      path: "test-results/run-view-failed-dark.png",
      fullPage: true,
    })
  })

  test("approval uses Confirmation, light and dark", async ({
    page,
    request,
  }) => {
    const runId = await startRun(request, "gate")
    await page.goto(`/runs/${runId}?task=hold`)
    await expect(page.getByTestId("task-state-hold")).toHaveText(
      "awaiting_approval",
      { timeout: 15_000 }
    )
    await expect(page.getByTestId("task-confirmation")).toBeVisible()
    await expect(page.getByTestId("run-waiting")).toBeVisible()
    await page.screenshot({
      path: "test-results/run-view-confirmation-light.png",
      fullPage: true,
    })

    await page.goto("/settings")
    await page.getByTestId("theme-toggle").getByText("Dark").click()
    await expect(page.locator("html")).toHaveClass(/dark/)
    await page.goto(`/runs/${runId}?task=hold`)
    await expect(page.getByTestId("task-confirmation")).toBeVisible()
    await page.screenshot({
      path: "test-results/run-view-confirmation-dark.png",
      fullPage: true,
    })

    await page.getByTestId("task-approve").first().click()
    await expect(page.getByTestId("task-state-hold")).toHaveText("succeeded", {
      timeout: 20_000,
    })
  })
})
