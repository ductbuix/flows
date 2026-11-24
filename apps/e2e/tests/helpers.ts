const API = process.env.PW_API_BASE ?? "http://127.0.0.1:8787"
const WEB_PORT = process.env.PW_WEB_PORT ?? "5173"
const WEB_ORIGIN = `http://127.0.0.1:${WEB_PORT}`

type JsonRpcResult = {
  jsonrpc: "2.0"
  id: number
  result?: unknown
  error?: { message: string; code: number }
}

/** Minimal FCP JSON-RPC over WebSocket (no sdk dep in e2e). */
async function fcpRequest(
  method: string,
  params: Record<string, unknown>
): Promise<unknown> {
  const bootRes = await fetch(`${API}/fcp/bootstrap`, {
    headers: { Origin: WEB_ORIGIN },
  })
  if (!bootRes.ok) {
    throw new Error(`fcp bootstrap failed: ${bootRes.status}`)
  }
  const boot = (await bootRes.json()) as { url: string; token: string }
  const url = new URL(boot.url)
  url.searchParams.set("token", boot.token)

  const WS = globalThis.WebSocket
  if (!WS) throw new Error("WebSocket is not available")

  const socket = new WS(url.toString())
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener("open", () => resolve())
    socket.addEventListener("error", () =>
      reject(new Error("WebSocket failed to open"))
    )
  })

  let nextId = 1
  const pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >()

  socket.addEventListener("message", (event) => {
    const raw = typeof event.data === "string" ? event.data : String(event.data)
    let msg: JsonRpcResult
    try {
      msg = JSON.parse(raw) as JsonRpcResult
    } catch {
      return
    }
    if (msg.id == null || !pending.has(msg.id)) return
    const entry = pending.get(msg.id)!
    pending.delete(msg.id)
    if (msg.error) {
      entry.reject(new Error(msg.error.message))
      return
    }
    entry.resolve(msg.result)
  })

  function request(
    methodName: string,
    requestParams: Record<string, unknown>
  ): Promise<unknown> {
    const id = nextId++
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject })
      socket.send(
        JSON.stringify({
          jsonrpc: "2.0",
          id,
          method: methodName,
          params: requestParams,
        })
      )
    })
  }

  try {
    await request("initialize", {
      protocolVersion: 1,
      clientInfo: { name: "e2e", version: "0.0.0" },
      clientCapabilities: {},
    })
    return await request(method, params)
  } finally {
    socket.close()
  }
}

/** Start a workflow run over FCP (never `/api`). */
export async function startRun(workflowId: string): Promise<string> {
  const result = (await fcpRequest("run/start", {
    workflowId,
    requestKey: crypto.randomUUID(),
  })) as { runId: string }
  return result.runId
}

export function e2eHome(): string {
  const home = process.env.FLOWAPP_HOME
  if (!home) throw new Error("FLOWAPP_HOME is not set")
  return home
}
