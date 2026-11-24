/** Preload API when the web build runs inside Electron (BL-186, BL-189, BL-190). */
interface FlowsDesktopApi {
  /**
   * Ask preload to open an FCP MessagePort. The peer port is delivered on
   * `window` as `{ type: "flows-fcp-local-port" }` with `event.ports[0]`.
   */
  connect(): void
  /** Show `path` in Finder (`host.revealPath` / `host/reveal_path`). */
  revealPath(path: string): void
  /** OS notification when the window is not focused (`host.notifications`). */
  notifyInboxItem(payload: { title: string; body: string }): void
  /** Cookie sign-in window (`host.browserSignIn` / `host/browser_sign_in`). */
  browserSignIn(params: {
    connectorId: string
    url: string
    cookieDomains: string[]
  }): Promise<{ cookies: unknown[] } | { cancelled: true }>
}

interface FlowsFcpBootstrap {
  url: string
  token: string
}

interface Window {
  flowsDesktop?: FlowsDesktopApi
  __FLOWS_FCP__?: FlowsFcpBootstrap
}
