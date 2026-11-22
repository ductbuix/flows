import { expect, test, type Page } from "@playwright/test"

// Runs against the FLOWS_NODES=1 stack (project "nodes", DES-037 Rollout).
test.use({ viewport: { width: 1440, height: 900 } })

const open = async (page: Page, id: string, theme: "light" | "dark") => {
  await page.addInitScript((t) => localStorage.setItem("theme", t), theme)
  await page.goto(`/workflows/${id}?tab=editor`)
}

/** Drags from a node's output handle to a spot on empty canvas. */
async function dragWireToEmpty(page: Page, nodeId: string, dx: number) {
  await page.getByRole("button", { name: "Fit view" }).click()
  await page.waitForTimeout(400)
  const handle = page
    .getByTestId(`node-${nodeId}`)
    .locator(".react-flow__handle.source")
  const box = (await handle.boundingBox())!
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx / 2, y + 40, { steps: 6 })
  await page.mouse.move(x + dx, y + 40, { steps: 6 })
  await page.mouse.up()
}

for (const theme of ["light", "dark"] as const) {
  test(`build Trigger, Command, Output from empty and save (${theme})`, async ({
    page,
  }, info) => {
    const id = `node-empty-${theme}`
    await open(page, id, theme)
    await expect(page.getByTestId("node-empty")).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByRole("button", { name: "Add a trigger" })).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Start from a sample" })
    ).toBeVisible()
    await page.screenshot({ path: info.outputPath(`node-empty-${theme}.png`) })

    // Trigger from the toolbar menu; search narrows the list.
    await page.getByTestId("add-node").click()
    await expect(page.getByTestId("add-node-agent")).toBeVisible()
    await page.getByPlaceholder("Search nodes").fill("trig")
    await expect(page.getByTestId("add-node-agent")).toBeHidden()
    await page.getByTestId("add-node-trigger").click()
    await expect(page.getByTestId("node-trigger")).toBeVisible()
    await expect(page.getByTestId("node-save")).toBeEnabled()

    // Command from a wire dropped on empty canvas; the list is port-filtered.
    await dragWireToEmpty(page, "trigger", 320)
    await expect(page.getByTestId("add-connected-node")).toBeVisible()
    await expect(page.getByTestId("add-node-trigger")).toBeHidden()
    await expect(page.getByTestId("add-node-prompt")).toBeHidden()
    await page.screenshot({ path: info.outputPath(`node-wire-${theme}.png`) })
    await page.getByPlaceholder("Search nodes").fill("command")
    await page.getByTestId("add-node-command").click()
    await expect(page.getByTestId("node-command")).toBeVisible()

    await dragWireToEmpty(page, "command", 320)
    await page.getByPlaceholder("Search nodes").fill("output")
    await page.getByTestId("add-node-output").click()
    await expect(page.getByTestId("node-output")).toBeVisible()
    await expect(page.locator(".react-flow__edge")).toHaveCount(2)

    // A bad wire is refused with the reason.
    await page.getByRole("button", { name: "Fit view" }).click()
    await page.waitForTimeout(400)
    const from = (await page
      .getByTestId("node-output")
      .locator(".react-flow__handle.source")
      .boundingBox())!
    const to = (await page
      .getByTestId("node-trigger")
      .locator(".react-flow__handle.target")
      .boundingBox())!
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
    await page.mouse.down()
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
      steps: 12,
    })
    await page.mouse.up()
    await expect(page.getByText("Output has no text output.")).toBeVisible()
    await expect(page.locator(".react-flow__edge")).toHaveCount(2)

    const saved = page.waitForResponse(
      (r) =>
        r.url().endsWith(`/api/workflows/${id}`) &&
        r.request().method() === "PUT"
    )
    await page.getByTestId("node-save").click()
    expect((await saved).ok()).toBeTruthy()
    await expect(page.getByTestId("node-save")).toBeDisabled()
    await page.screenshot({ path: info.outputPath(`node-add-${theme}.png`) })

    const detail = (await (
      await page.request.get(`/api/workflows/${id}`)
    ).json()) as { yaml: string }
    expect(detail.yaml.match(/^\s+- id: /gm)).toHaveLength(3)
    expect(detail.yaml.match(/^\s+- \{ from:/gm)).toHaveLength(2)
    expect(detail.yaml).toContain("kind: trigger")
    expect(detail.yaml).toContain("kind: command")
    expect(detail.yaml).toContain("kind: output")

    // Positions saved with the workflow: nodes keep their place on reload.
    await page.reload()
    await expect(page.getByTestId("node-output")).toBeVisible()
    await expect(page.locator(".react-flow__edge")).toHaveCount(2)
  })
}

test("start from a sample adds a wired Trigger, Agent and Output", async ({
  page,
}) => {
  await open(page, "node-sample", "light")
  await page.getByRole("button", { name: "Start from a sample" }).click()
  await expect(page.getByTestId("node-trigger")).toBeVisible()
  await expect(page.getByTestId("node-agent")).toBeVisible()
  await expect(page.getByTestId("node-output")).toBeVisible()
  await expect(page.locator(".react-flow__edge")).toHaveCount(2)
})
