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

/** Open the Editor tab for a workflow (Graph pane by default). */
export async function openEditor(
  page: Page,
  workflowId: string
): Promise<void> {
  await page.goto(`/workflows/${workflowId}?tab=editor`)
  await expect(page.getByTestId("graph-canvas")).toBeVisible({
    timeout: 15_000,
  })
}

/** Switch the Editor to the YAML pane. */
export async function openYamlTab(page: Page): Promise<void> {
  await page.getByTestId("editor-tab-yaml").click()
  await expect(page.getByTestId("yaml-pane")).toBeVisible()
}

/** Switch the Editor to the Graph pane. */
export async function openGraphTab(page: Page): Promise<void> {
  await page.getByTestId("editor-tab-graph").click()
  await expect(page.getByTestId("graph-canvas")).toBeVisible()
}
