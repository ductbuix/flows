import { expect, test } from "@playwright/test"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

const HOME = process.env.FLOWAPP_HOME!
const API = process.env.PW_API_BASE!

test.describe("workflow lifecycle", () => {
  test("create, rename and delete a workflow", async ({ page, request }) => {
    test.setTimeout(60_000)
    const id = `life-${crypto.randomUUID().slice(0, 8)}`
    const renamed = `${id}-renamed`
    await page.goto("/")
    await page.getByTestId("workflow-create-open").click()
    await expect(page.getByTestId("workflow-create")).toBeVisible()
    await page.getByTestId("create-name-input").fill("Named e2e")
    await page.getByTestId("create-id-input").fill(id)
    await page.getByTestId("create-goal-input").fill("lifecycle e2e")
    await page.getByTestId("create-submit").click()

    await expect(page).toHaveURL(new RegExp(`/workflows/${id}$`))
    await expect(page.getByTestId("workflow-overview")).toBeVisible({
      timeout: 15_000,
    })
    expect(existsSync(join(HOME, "workflows", id, "workflow.yaml"))).toBe(true)

    // Seed a finished run so rename can rebind history.
    const startRes = await request.post(`${API}/api/workflows/${id}/runs`, {
      data: { requestId: crypto.randomUUID() },
    })
    expect(startRes.ok()).toBeTruthy()
    const { runId } = (await startRes.json()) as { runId: string }
    await expect
      .poll(
        async () => {
          const res = await request.get(`${API}/api/runs/${runId}`)
          const body = (await res.json()) as { status: string }
          return body.status
        },
        { timeout: 20_000 }
      )
      .toBe("succeeded")

    // Reload so action buttons re-check live status.
    await page.goto(`/workflows/${id}`)
    await expect(page.getByTestId("workflow-overview")).toBeVisible({
      timeout: 15_000,
    })

    await page.getByTestId(`sidebar-workflow-menu-${id}`).click()
    await page.getByTestId(`workflow-rename-open-${id}`).click()
    await expect(page.getByTestId("workflow-rename")).toBeVisible()
    await page.getByTestId("rename-id-input").fill(renamed)
    await page.getByTestId("rename-submit").click()
    await expect(page).toHaveURL(new RegExp(`/workflows/${renamed}$`))
    expect(existsSync(join(HOME, "workflows", id))).toBe(false)
    expect(existsSync(join(HOME, "workflows", renamed, "workflow.yaml"))).toBe(
      true
    )
    const yaml = readFileSync(
      join(HOME, "workflows", renamed, "workflow.yaml"),
      "utf8"
    )
    expect(yaml).toMatch(new RegExp(`^id: ${renamed}$`, "m"))

    const runs = await request.get(`${API}/api/workflows/${renamed}/runs`)
    const list = (await runs.json()) as Array<{ id: string }>
    expect(list.map((r) => r.id)).toContain(runId)

    await page.getByTestId(`sidebar-workflow-menu-${renamed}`).click()
    await page.getByTestId(`workflow-delete-open-${renamed}`).click()
    await expect(page.getByTestId("workflow-delete")).toBeVisible()
    await page.getByTestId("delete-confirm-input").fill(renamed)
    await page.getByTestId("delete-submit").click()
    await expect(page).toHaveURL("/")
    expect(existsSync(join(HOME, "workflows", renamed))).toBe(false)
  })
})
