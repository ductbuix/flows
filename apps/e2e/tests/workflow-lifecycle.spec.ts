import { expect, test } from "@playwright/test"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
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
    await page.getByTestId("create-id-input").fill(id)
    await page.getByTestId("create-goal-input").fill("lifecycle e2e")
    await page.getByTestId("create-submit").click()

    await expect(page).toHaveURL(new RegExp(`/workflows/${id}$`))
    await expect(page.getByTestId("graph-canvas")).toBeVisible({
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
    await expect(page.getByTestId("graph-canvas")).toBeVisible({
      timeout: 15_000,
    })

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

    await page.getByTestId(`workflow-delete-open-${renamed}`).click()
    await expect(page.getByTestId("workflow-delete")).toBeVisible()
    await page.getByTestId("delete-confirm-input").fill(renamed)
    await page.getByTestId("delete-submit").click()
    await expect(page).toHaveURL("/")
    expect(existsSync(join(HOME, "workflows", renamed))).toBe(false)
  })

  test("edit a memory file and show future-launch warning", async ({
    page,
  }) => {
    const wf = join(HOME, "workflows", "diamond")
    mkdirSync(join(wf, "memory"), { recursive: true })
    writeFileSync(join(wf, "memory", "style.md"), "# before\n")

    await page.goto("/workflows/diamond")
    await expect(page.getByTestId("memory-list")).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByTestId("memory-row-style.md")).toBeVisible()
    await page
      .getByTestId("memory-row-style.md")
      .getByRole("button")
      .first()
      .click()
    await expect(page.getByTestId("memory-editor")).toBeVisible()
    await expect(page.getByTestId("memory-editor")).toContainText(
      "future launches only"
    )

    const area = page.getByTestId("memory-editor").locator("textarea")
    await area.fill("# after\n")
    await page.getByTestId("memory-save").click()
    await expect(page.getByTestId("memory-editor")).toBeHidden()
    expect(readFileSync(join(wf, "memory", "style.md"), "utf8")).toBe(
      "# after\n"
    )
  })

  test("remove memory from editor and import with collision", async ({
    page,
  }) => {
    test.setTimeout(60_000)
    const wf = join(HOME, "workflows", "diamond")
    mkdirSync(join(wf, "memory"), { recursive: true })
    writeFileSync(join(wf, "memory", "keep.md"), "# keep\n")
    writeFileSync(join(wf, "memory", "gone.md"), "# gone\n")

    await page.goto("/workflows/diamond")
    await expect(page.getByTestId("memory-row-gone.md")).toBeVisible({
      timeout: 15_000,
    })
    await page
      .getByTestId("memory-row-gone.md")
      .getByRole("button")
      .first()
      .click()
    await expect(page.getByTestId("memory-editor")).toBeVisible()
    await page.getByTestId("memory-remove").click()
    await page.getByRole("button", { name: "Delete" }).click()
    await expect(page.getByTestId("memory-editor")).toBeHidden()
    await expect(page.getByTestId("memory-row-gone.md")).toHaveCount(0)
    expect(existsSync(join(wf, "memory", "gone.md"))).toBe(false)

    const pickDir = join(HOME, "picks")
    mkdirSync(pickDir, { recursive: true })
    const colliding = join(pickDir, "keep.md")
    writeFileSync(colliding, "# imported\n")
    await page.getByTestId("memory-pick").setInputFiles(colliding)
    await expect(page.getByTestId("memory-collision")).toBeVisible()
    await page.getByTestId("memory-collision-overwrite").click()
    await expect(page.getByTestId("memory-editor")).toBeVisible()
    expect(readFileSync(join(wf, "memory", "keep.md"), "utf8")).toBe(
      "# imported\n"
    )
    await page.getByRole("button", { name: "Cancel" }).click()

    writeFileSync(colliding, "# renamed import\n")
    await page.getByTestId("memory-pick").setInputFiles(colliding)
    await expect(page.getByTestId("memory-collision")).toBeVisible()
    await page.locator("#memory-collision-name").fill("keep-copy.md")
    await page.getByTestId("memory-collision-add").click()
    await expect(page.getByTestId("memory-row-keep-copy.md")).toBeVisible()
    expect(readFileSync(join(wf, "memory", "keep-copy.md"), "utf8")).toBe(
      "# renamed import\n"
    )
  })
})
