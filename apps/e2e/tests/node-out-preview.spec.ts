import { expect, test } from "@playwright/test"

test.use({ viewport: { width: 1440, height: 900 } })

const API = `http://127.0.0.1:${process.env.PW_API_PORT ?? "8787"}`

test("clicking an out file opens a read-only preview", async ({
  page,
  request,
}, info) => {
  const res = await request.post(`${API}/api/workflows/node-out-preview/runs`, {
    data: { requestId: crypto.randomUUID() },
  })
  expect(res.ok()).toBeTruthy()
  const { runId } = (await res.json()) as { runId: string }

  await page.goto(`/runs/${runId}?task=build`)
  await expect(page.getByTestId("task-detail")).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByTestId("task-detail-status")).toHaveText("succeeded", {
    timeout: 20_000,
  })
  await expect(page.getByTestId("out-file-tree")).toBeVisible()
  await page.getByTestId("out-file-text.md").click()
  const preview = page.getByTestId("out-file-preview")
  await expect(preview).toBeVisible()
  await expect(page.getByTestId("out-file-preview-content")).toHaveText(
    "hello out\n"
  )
  await page.screenshot({ path: info.outputPath("node-out-preview.png") })
})
