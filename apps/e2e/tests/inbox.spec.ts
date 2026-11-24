import { expect, test } from "@playwright/test"
import { cancelLiveRuns, fcpRequest, startRun } from "./helpers"

type InboxRow = {
  id: string
  status: string
  kind: string
  runId?: string
}

async function openInboxItems(): Promise<InboxRow[]> {
  const listed = (await fcpRequest("inbox/list", {})) as { items: InboxRow[] }
  return listed.items.filter((i) => i.status === "open")
}

/** Dismiss every open item; shared FLOWAPP_HOME is not empty by default. */
async function dismissAllOpenInbox(): Promise<void> {
  for (const item of await openInboxItems()) {
    await fcpRequest("inbox/dismiss", {
      itemId: item.id,
      requestKey: crypto.randomUUID(),
    }).catch(() => undefined)
  }
}

async function waitForItem(
  pred: (items: InboxRow[]) => InboxRow | undefined,
  timeout = 20_000
): Promise<InboxRow> {
  let found: InboxRow | undefined
  await expect
    .poll(
      async () => {
        found = pred(await openInboxItems())
        return found?.id ?? null
      },
      { timeout }
    )
    .toEqual(expect.any(String))
  return found!
}

test.describe("inbox (DES-044)", () => {
  test("empty", async ({ page }) => {
    await dismissAllOpenInbox()
    await page.goto("/inbox")
    await expect(page.getByTestId("inbox-page")).toBeVisible()
    await expect(page.getByTestId("inbox-empty")).toBeVisible()
  })

  test("approval", async ({ page }) => {
    await cancelLiveRuns("node-approval-home")
    const runId = await startRun("node-approval-home")
    const itemId = `approval:${runId}:gate:1`

    await page.goto("/inbox")
    const item = page.getByTestId(`inbox-item-${itemId}`)
    await expect(item).toBeVisible({ timeout: 20_000 })
    await expect(item).toContainText("Ship the change?")

    await page.getByTestId(`inbox-approve-${itemId}`).click()
    await expect(item).toHaveCount(0, { timeout: 15_000 })
  })

  test("permission", async ({ page }) => {
    await cancelLiveRuns("agent-acp-ask")
    const runId = await startRun("agent-acp-ask")
    const row = await waitForItem((items) =>
      items.find((i) => i.kind === "permission" && i.runId === runId)
    )

    await page.goto("/inbox")
    const item = page.getByTestId(`inbox-item-${row.id}`)
    await expect(item).toBeVisible()
    await page.getByTestId(`inbox-allow-once-${row.id}`).click()
    await expect(item).toHaveCount(0, { timeout: 15_000 })
  })

  test("question", async ({ page }) => {
    await cancelLiveRuns("agent-acp-question")
    const runId = await startRun("agent-acp-question")
    const row = await waitForItem((items) =>
      items.find((i) => i.kind === "question" && i.runId === runId)
    )

    await page.goto("/inbox")
    const item = page.getByTestId(`inbox-item-${row.id}`)
    await expect(item).toBeVisible()
    await page.getByTestId(`inbox-qopt-${row.id}-q1-plan`).click()
    await page.getByTestId(`inbox-answer-${row.id}`).click()
    await expect(item).toHaveCount(0, { timeout: 15_000 })
  })

  test("plan review", async ({ page }) => {
    await cancelLiveRuns("agent-acp-plan")
    const runId = await startRun("agent-acp-plan")
    const row = await waitForItem((items) =>
      items.find((i) => i.kind === "plan_review" && i.runId === runId)
    )

    await page.goto("/inbox")
    const item = page.getByTestId(`inbox-item-${row.id}`)
    await expect(item).toBeVisible()
    await expect(item).toContainText("E2E plan")
    await page.getByTestId(`inbox-accept-${row.id}`).click()
    await expect(item).toHaveCount(0, { timeout: 15_000 })
  })

  test("dismiss", async ({ page }) => {
    await cancelLiveRuns("node-approval-home")
    const runId = await startRun("node-approval-home")
    const itemId = `approval:${runId}:gate:1`

    await page.goto("/inbox")
    const item = page.getByTestId(`inbox-item-${itemId}`)
    await expect(item).toBeVisible({ timeout: 20_000 })
    await page.getByTestId(`inbox-dismiss-${itemId}`).click()
    await expect(item).toHaveCount(0, { timeout: 15_000 })
  })
})
