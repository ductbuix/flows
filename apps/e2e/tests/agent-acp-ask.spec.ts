import { expect, test } from "@playwright/test"
import { fcpRequest, startRun } from "./helpers"

test.describe("agent ACP permission ask (BL-195)", () => {
  test("permission inbox item resumes the core agent run", async ({ page }) => {
    const runId = await startRun("agent-acp-ask")

    await expect
      .poll(
        async () => {
          const listed = (await fcpRequest("inbox/list", {})) as {
            items: { id: string; kind: string }[]
          }
          return (
            listed.items.find(
              (i) => i.kind === "permission" && i.id.includes(runId)
            )?.id ?? null
          )
        },
        { timeout: 20_000 }
      )
      .toEqual(expect.any(String))

    const listed = (await fcpRequest("inbox/list", {})) as {
      items: { id: string }[]
    }
    const itemId = listed.items.find((i) => i.id.includes(runId))!.id

    await page.goto("/inbox")
    await expect(page.getByTestId(`inbox-item-${itemId}`)).toBeVisible()
    await page.getByTestId(`inbox-allow-once-${itemId}`).click()
    await expect(page.getByTestId(`inbox-item-${itemId}`)).toHaveCount(0, {
      timeout: 15_000,
    })

    await expect
      .poll(
        async () => {
          const summary = (await fcpRequest("run/get", { id: runId })) as {
            status?: string
          }
          return summary.status
        },
        { timeout: 20_000 }
      )
      .toBe("succeeded")
  })
})
