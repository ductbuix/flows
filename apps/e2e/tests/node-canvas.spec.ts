import { expect, test } from "@playwright/test"

// Runs against the FLOWS_NODES=1 stack (project "nodes", DES-037 Rollout).
test.use({ viewport: { width: 1440, height: 900 } })

for (const theme of ["light", "dark"] as const) {
  test(`drag a node, reload, it stays in place (${theme})`, async ({
    page,
  }, info) => {
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme)
    await page.goto("/workflows/node-canvas?tab=editor")
    const node = page.getByTestId("node-write")
    await expect(page.getByTestId("canvas")).toBeVisible({ timeout: 15_000 })
    await expect(node).toBeVisible()
    await expect(page.getByTestId("node-start")).toBeVisible()
    await expect(page.getByTestId("node-done")).toBeVisible()
    await expect(page.locator(".react-flow__edge")).toHaveCount(2)

    // fitView re-fits on load, so compare against another node, in node widths.
    const rel = async () => {
      const a = (await node.boundingBox())!
      const b = (await page.getByTestId("node-start").boundingBox())!
      return { x: (a.x - b.x) / a.width, y: (a.y - b.y) / a.width }
    }
    const before = (await node.boundingBox())!
    const relBefore = await rel()
    const saved = page.waitForResponse(
      (r) => r.url().includes("/layout") && r.request().method() === "PUT"
    )
    await page.mouse.move(before.x + 40, before.y + 20)
    await page.mouse.down()
    await page.mouse.move(before.x + 40, before.y + 160, { steps: 8 })
    await page.mouse.up()
    expect((await saved).ok()).toBeTruthy()

    const dragged = await rel()
    expect(dragged.y - relBefore.y).toBeGreaterThan(0.4)

    await page.reload()
    await expect(node).toBeVisible()
    const after = await rel()
    expect(Math.abs(after.y - dragged.y)).toBeLessThan(0.02)
    expect(Math.abs(after.x - dragged.x)).toBeLessThan(0.02)
    await page.screenshot({
      path: info.outputPath(`node-canvas-${theme}.png`),
    })
  })
}
