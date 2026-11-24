/** Preload API when the web build runs inside Electron (BL-186). */
interface FlowsDesktopApi {
  /**
   * Ask preload to open an FCP MessagePort. The peer port is delivered on
   * `window` as `{ type: "flows-fcp-local-port" }` with `event.ports[0]`.
   */
  connect(): void
}

interface FlowsFcpBootstrap {
  url: string
  token: string
}

interface Window {
  flowsDesktop?: FlowsDesktopApi
  __FLOWS_FCP__?: FlowsFcpBootstrap
}
