import { expect, type APIRequestContext } from "@playwright/test"

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
