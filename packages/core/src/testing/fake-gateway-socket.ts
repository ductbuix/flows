import type {
  GatewaySocketHandle,
  GatewaySocketListenOpts,
  GatewaySocketServer,
} from "../ports/gateway-socket.ts"

/**
 * In-process GatewaySocketServer: records listens and exposes `invoke` so
 * tests can drive onCall without a real unix socket.
 */
export function createFakeGatewaySocketServer(): FakeGatewaySocketServer {
  return new FakeGatewaySocketServer()
}

export class FakeGatewaySocketServer implements GatewaySocketServer {
  readonly listens: Array<{
    path: string
    token: string
    invoke: GatewaySocketListenOpts["onCall"]
  }> = []

  async listen(opts: GatewaySocketListenOpts): Promise<GatewaySocketHandle> {
    const entry = {
      path: opts.path,
      token: opts.token,
      invoke: opts.onCall,
    }
    this.listens.push(entry)
    const listens = this.listens
    return {
      path: opts.path,
      async close() {
        const i = listens.indexOf(entry)
        if (i >= 0) listens.splice(i, 1)
      },
    }
  }

  /** Call the active listener for `path`, refusing a bad token. */
  async invoke(
    path: string,
    token: string,
    call: { name: string; arguments: Record<string, unknown> },
    signal: AbortSignal = new AbortController().signal
  ) {
    const entry = this.listens.find((l) => l.path === path)
    if (!entry) throw new Error(`no listener at ${path}`)
    if (token !== entry.token) throw new Error("unknown step token")
    return entry.invoke(call, signal)
  }
}
