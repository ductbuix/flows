import { contextBridge, ipcRenderer } from "electron"

/**
 * Renderer API through contextBridge (DES-039 / BL-189 / BL-190).
 * contextIsolation on, nodeIntegration off — enforced in main.
 */
contextBridge.exposeInMainWorld("flowsDesktop", {
  connect(): void {
    const { port1, port2 } = new MessageChannel()
    ipcRenderer.postMessage("flows:connect", null, [port2])
    window.postMessage({ type: "flows-fcp-local-port" }, "*", [port1])
  },
  revealPath(path: string): void {
    ipcRenderer.send("flows:reveal-path", path)
  },
  notifyInboxItem(payload: { title: string; body: string }): void {
    ipcRenderer.send("flows:notify-inbox", payload)
  },
  browserSignIn(params: {
    connectorId: string
    url: string
    cookieDomains: string[]
  }): Promise<{ cookies: unknown[] } | { cancelled: true }> {
    return ipcRenderer.invoke("flows:browser-sign-in", params) as Promise<
      { cookies: unknown[] } | { cancelled: true }
    >
  },
})
