/** Preload API when the web build runs inside Electron (BL-186, BL-189). */
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
}

interface FlowsFcpBootstrap {
  url: string
  token: string
}

interface Window {
  flowsDesktop?: FlowsDesktopApi
  __FLOWS_FCP__?: FlowsFcpBootstrap
}
