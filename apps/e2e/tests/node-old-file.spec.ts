import { expect, test } from "@playwright/test"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { e2eHome } from "./helpers"

// An old task-format file shows its validation error (DES-033 Old files).
test("an old-format workflow shows the error naming its first old key", async ({
  page,
}) => {
  const dir = join(e2eHome(), "workflows", "old-tasks")
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, "workflow.yaml"),
    "id: old-tasks\ngoal: old format\ntasks:\n  - id: a\n    kind: command\n    run: echo a\n"
  )

  await page.goto("/workflows/old-tasks?tab=editor")
  const errors = page.getByTestId("yaml-errors")
  await expect(errors).toBeVisible({ timeout: 15_000 })
  await expect(errors).toContainText('old workflow format: key "tasks"')
  await expect(page.getByTestId("canvas")).toHaveCount(0)
})
