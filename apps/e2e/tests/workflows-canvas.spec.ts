import { expect, test } from "@playwright/test"

type Box = { x: number; y: number; width: number; height: number }

function overlaps(a: Box, b: Box): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  )
}

test.describe("workflows-canvas.spec.ts › drag collision", () => {
  test("dropping a node onto another pushes them apart", async ({ page }) => {
    await page.goto("/workflows/diamond")
    await expect(page.getByTestId("workflow-canvas")).toBeVisible()
    await page.getByTestId("workflow-canvas-fit").click()

    const target = page.getByTestId("canvas-node-command")
    const dragged = page.getByTestId("canvas-node-output")
    const targetBox = await target.boundingBox()
    const startBox = await dragged.boundingBox()
    expect(targetBox).toBeTruthy()
    expect(startBox).toBeTruthy()

    // Grab the dragged node's header and drop it on the target's header.
    await page.mouse.move(startBox!.x + startBox!.width / 2, startBox!.y + 8)
    await page.mouse.down()
    await page.mouse.move(
      targetBox!.x + targetBox!.width / 2,
      targetBox!.y + 8,
      { steps: 12 }
    )
    await page.mouse.up()

    await expect
      .poll(async () => {
        const box = await dragged.boundingBox()
        return box ? box.x !== startBox!.x || box.y !== startBox!.y : false
      })
      .toBe(true)
    await expect
      .poll(async () => {
        const a = await dragged.boundingBox()
        const b = await target.boundingBox()
        return a && b ? overlaps(a, b) : true
      })
      .toBe(false)
  })
})
