import { expect, type APIRequestContext, type Page } from "@playwright/test"

const API = process.env.PW_API_BASE ?? "http://127.0.0.1:8787"

export async function startRun(
  request: APIRequestContext,
  workflowId: string
): Promise<string> {
  const res = await request.post(`${API}/api/workflows/${workflowId}/runs`, {
    data: { requestId: crypto.randomUUID() },
  })
  expect(res.ok()).toBeTruthy()
  const body = (await res.json()) as { runId: string }
  return body.runId
}

export function e2eHome(): string {
  const home = process.env.FLOWAPP_HOME
  if (!home) throw new Error("FLOWAPP_HOME is not set")
  return home
}

/** Turn on the shared Advanced switch (`flows-advanced`). */
export async function enableAdvanced(page: Page): Promise<void> {
  const control = page.getByTestId("advanced-switch-control")
  await expect(control).toBeVisible()
  if (!(await control.isChecked())) {
    await control.click()
  }
  await expect(control).toBeChecked()
}

/** Turn off the shared Advanced switch. */
export async function disableAdvanced(page: Page): Promise<void> {
  const control = page.getByTestId("advanced-switch-control")
  await expect(control).toBeVisible()
  if (await control.isChecked()) {
    await control.click()
  }
  await expect(control).not.toBeChecked()
}
