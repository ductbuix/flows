import { expect, test } from "@playwright/test"

// Node workflows on the default stack (BL-096).
test.use({ viewport: { width: 1440, height: 900 } })

for (const theme of ["light", "dark"] as const) {
  test(`edit an Agent task on the card, save, find it in prompt.md (${theme})`, async ({
    page,
  }, info) => {
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme)
    await page.goto("/workflows/node-cards?tab=editor")
    await expect(page.getByTestId("canvas")).toBeVisible({ timeout: 15_000 })

    // Every kind shows its settings on the card.
    const agent = page.getByTestId("node-plan")
    await expect(agent.getByTestId("node-cli")).toHaveText("claude")
    await expect(agent.getByTestId("agent-task")).toHaveValue(
      "Plan the work.\n"
    )
    await expect(
      page.getByTestId("node-rules").getByTestId("prompt-text")
    ).toHaveValue("Be brief.\n")
    await expect(
      page.getByTestId("node-build").getByTestId("command-run")
    ).toHaveValue("echo build")
    await expect(page.getByTestId("trigger-type")).toHaveText("Manual")
    await expect(page.getByTestId("output-target")).toHaveText("Folder")
    // Steps are w-72 (288px), inputs and flow w-60 (240px) at zoom 1.
    await page.getByRole("button", { name: "Fit view" }).click()
    await page.waitForTimeout(400)
    const wAgent = (await agent.boundingBox())!.width
    const wOut = (await page.getByTestId("node-done").boundingBox())!.width
    expect(wAgent / wOut).toBeCloseTo(288 / 240, 1)

    const task = agent.getByTestId("agent-task")
    await task.fill("Write the release notes.")
    await expect(page.getByTestId("node-save")).toBeEnabled()

    // Undo and redo cover the edit.
    await page.getByTestId("node-undo").click()
    await expect(task).toHaveValue("Plan the work.\n")
    await expect(page.getByTestId("node-save")).toBeDisabled()
    await page.getByTestId("node-redo").click()
    await expect(task).toHaveValue("Write the release notes.")

    // A setting writes YAML: switch the CLI.
    await agent.getByTestId("node-cli").click()
    await page.getByRole("menuitemradio", { name: "cursor" }).click()
    await expect(agent.getByTestId("node-cli")).toHaveText("cursor")
    await page.screenshot({ path: info.outputPath(`node-cards-${theme}.png`) })

    const saved = page.waitForResponse(
      (r) =>
        decodeURIComponent(r.url()).includes("/files/nodes/plan/prompt.md") &&
        r.request().method() === "PUT"
    )
    await page.getByTestId("node-save").click()
    expect((await saved).ok()).toBeTruthy()
    await expect(page.getByTestId("node-save")).toBeDisabled()

    const file = (await (
      await page.request.get(
        "/api/workflows/node-cards/files/nodes/plan/prompt.md"
      )
    ).json()) as { content: string }
    expect(file.content).toBe("Write the release notes.")
    const wf = (await (
      await page.request.get("/api/workflows/node-cards")
    ).json()) as {
      yaml: string
    }
    expect(wf.yaml).toContain("cli: cursor")

    // Restore for the next theme.
    await agent.getByTestId("node-cli").click()
    await page.getByRole("menuitemradio", { name: "claude" }).click()
    await task.fill("Plan the work.\n")
    await page.getByTestId("node-save").click()
    await expect(page.getByTestId("node-save")).toBeDisabled()
  })
}
