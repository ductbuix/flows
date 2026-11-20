import { existsSync } from "node:fs"
import { join } from "node:path"
import { expect, test } from "@playwright/test"
import { e2eHome, startRun } from "./helpers"

test.describe("run controls", () => {
  test("cancel a live run after confirm", async ({ page, request }) => {
    const runId = await startRun(request, "slow-cancel")
    await page.goto(`/workflows/slow-cancel/runs/${runId}?task=slow`)

    await expect(page.getByTestId("run-status")).toHaveText("running", {
      timeout: 15_000,
    })
    await expect(page.getByTestId("task-state-slow")).toHaveText("running", {
      timeout: 15_000,
    })

    await page.getByTestId("run-cancel").click()
    const dialog = page.getByTestId("confirm-dialog")
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText("Running tasks are stopped")
    await page.getByTestId("confirm-ok").click()

    await expect(page.getByTestId("run-status")).toHaveText("cancelled", {
      timeout: 15_000,
    })
    await expect(page.getByTestId("task-state-slow")).toHaveText("cancelled")
  })

  test("manual retry shows Manual retry attempt", async ({ page, request }) => {
    const runId = await startRun(request, "fail-manual")
    await page.goto(`/workflows/fail-manual/runs/${runId}?task=boom`)

    await expect(page.getByTestId("task-state-boom")).toHaveText("failed", {
      timeout: 20_000,
    })
    await expect(page.getByTestId("run-status")).toHaveText("failed")

    await page.getByTestId("task-retry").click()
    // Retry reopens then fails again quickly; wait for a second attempt.
    await page.getByTestId("task-tab-attempts").click()
    await expect(page.getByTestId("attempt-kind-2")).toContainText(
      "Manual retry",
      { timeout: 20_000 }
    )
    await expect(page.getByTestId("task-state-boom")).toHaveText("failed")
  })

  test("approve a gated task so it runs", async ({ page, request }) => {
    const runId = await startRun(request, "gate")
    await page.goto(`/workflows/gate/runs/${runId}?task=hold`)

    await expect(page.getByTestId("run-waiting")).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByTestId("task-state-hold")).toHaveText(
      "awaiting_approval"
    )

    await page.getByTestId("task-approve").first().click()
    await expect(page.getByTestId("task-state-hold")).toHaveText("succeeded", {
      timeout: 20_000,
    })
    await expect(page.getByTestId("task-state-after")).toHaveText("succeeded", {
      timeout: 20_000,
    })
    await expect(page.getByTestId("run-status")).toHaveText("succeeded")
  })

  test("reject a gated task after confirm", async ({ page, request }) => {
    const runId = await startRun(request, "gate-reject")
    await page.goto(`/workflows/gate-reject/runs/${runId}?task=hold`)

    await expect(page.getByTestId("task-state-hold")).toHaveText(
      "awaiting_approval",
      { timeout: 15_000 }
    )

    await page.getByTestId("task-reject").click()
    const dialog = page.getByTestId("confirm-dialog")
    await expect(dialog).toContainText("ends as failed")
    await page.getByTestId("confirm-ok").click()

    await expect(page.getByTestId("task-state-hold")).toHaveText("failed", {
      timeout: 15_000,
    })
    await expect(page.getByTestId("run-status")).toHaveText("failed")
  })

  test("delete a finished run and block delete while live", async ({
    page,
    request,
  }) => {
    const liveId = await startRun(request, "slow-cancel")
    await page.goto(`/workflows/slow-cancel`)
    await expect(page.getByTestId(`run-row-${liveId}`)).toBeVisible({
      timeout: 10_000,
    })
    await page.getByTestId(`run-menu-${liveId}`).click()
    await expect(page.getByTestId("run-delete")).toBeDisabled()

    await page.getByTestId(`run-menu-${liveId}`).press("Escape")
    await page.goto(`/workflows/slow-cancel/runs/${liveId}`)
    await page.getByTestId("run-cancel").click()
    await page.getByTestId("confirm-ok").click()
    await expect(page.getByTestId("run-status")).toHaveText("cancelled", {
      timeout: 15_000,
    })

    const finishedId = await startRun(request, "diamond")
    await page.goto(`/workflows/diamond/runs/${finishedId}`)
    await expect(page.getByTestId("run-status")).toHaveText("succeeded", {
      timeout: 30_000,
    })

    await page.getByTestId(`run-menu-${finishedId}`).click()
    await page.getByTestId("run-delete").click()
    const dialog = page.getByTestId("confirm-dialog")
    await expect(dialog).toContainText(`runs/${finishedId}/`)
    await expect(dialog).toContainText("graph.json")
    await page.getByTestId("confirm-ok").click()

    await expect(page).toHaveURL(/\/workflows\/diamond$/)
    await expect(page.getByTestId(`run-row-${finishedId}`)).toHaveCount(0)

    const runRoot = join(
      e2eHome(),
      "workflows",
      "diamond",
      "runs",
      finishedId
    )
    expect(existsSync(runRoot)).toBe(false)
  })
})
