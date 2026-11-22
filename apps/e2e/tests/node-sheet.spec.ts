import { expect, test } from "@playwright/test"

// Runs against the FLOWS_NODES=1 stack (project "nodes", DES-037 Rollout).
test.use({ viewport: { width: 1440, height: 900 } })

for (const theme of ["light", "dark"] as const) {
  test(`node Sheet: timeout, Trigger input, delete node (${theme})`, async ({
    page,
  }, info) => {
    const id = `node-sheet-${theme}`
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme)
    await page.goto(`/workflows/${id}?tab=editor`)
    await expect(page.getByTestId("canvas")).toBeVisible({ timeout: 15_000 })

    // Settings button opens the 384px Sheet; Esc returns focus to the node.
    await page.getByTestId("node-settings-build").click()
    const sheet = page.getByTestId("node-sheet")
    await expect(sheet).toBeVisible()
    await expect
      .poll(async () => (await sheet.boundingBox())!.width)
      .toBeCloseTo(384, 0)
    await page.getByTestId("node-timeout").fill("30")
    await page.getByTestId("node-retry").fill("2")
    await page.getByTestId("node-name").fill("Build it")
    await page.screenshot({ path: info.outputPath(`node-sheet-${theme}.png`) })
    await page.keyboard.press("Escape")
    await expect(sheet).toBeHidden()
    await expect(
      page.locator('.react-flow__node[data-id="build"]')
    ).toBeFocused()
    await expect(page.getByTestId("node-build")).toContainText("Build it")

    // Agent Sheet: memory Combobox.
    await page.getByTestId("node-settings-plan").click()
    await page.getByLabel("Memory files").click()
    await page.getByRole("option", { name: "style.md" }).click()
    await expect(page.getByTestId("node-memory")).toContainText("style.md")
    await page.keyboard.press("Escape")
    await page.keyboard.press("Escape")
    await expect(sheet).toBeHidden()

    // Trigger Sheet: add an input in the 448px dialog.
    await page.getByTestId("node-settings-start").click()
    await page.getByTestId("input-add").click()
    const dialog = page.getByTestId("input-edit-dialog")
    await expect(dialog).toBeVisible()
    // The dialog zooms in; measure once it settles.
    await expect
      .poll(async () => (await dialog.boundingBox())!.width)
      .toBeCloseTo(448, 0)
    await page.getByTestId("input-edit-name").fill("topic")
    await page.getByTestId("input-edit-required").click()
    await page.screenshot({
      path: info.outputPath(`node-sheet-input-${theme}.png`),
    })
    await page.getByTestId("input-edit-done").click()
    await expect(page.getByTestId("input-row-topic")).toBeVisible()
    await expect(page.getByTestId("node-start")).toContainText("1 input")
    await page.keyboard.press("Escape")
    await expect(sheet).toBeHidden()

    // Delete a node: its edges go, Save trashes its folder.
    await page.getByTestId("node-settings-plan").click()
    await page.getByTestId("node-delete").click()
    await expect(page.getByTestId("node-plan")).toHaveCount(0)

    await page.getByTestId("node-save").click()
    await expect(page.getByTestId("node-save")).toBeDisabled()
    const wf = (await (await page.request.get(`/api/workflows/${id}`)).json()) as {
      yaml: string
    }
    expect(wf.yaml).toContain("timeout: 30")
    expect(wf.yaml).toContain("name: Build it")
    expect(wf.yaml).toContain("topic")
    expect(wf.yaml).not.toContain("id: plan")
    expect(wf.yaml).not.toContain("from: plan")
    expect(wf.yaml).not.toContain("to: plan")
    const gone = await page.request.get(
      `/api/workflows/${id}/files/nodes/plan/prompt.md`
    )
    expect(gone.status()).toBe(404)
  })
}
