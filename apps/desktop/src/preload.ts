import { contextBridge, ipcRenderer } from "electron"

/**
 * Renderer API: only `connect()` through contextBridge (DES-039).
 * Creates a MessageChannel in the preload world, sends one end to the
 * utility-process engine, and delivers the other to the renderer via
 * window.postMessage (contextBridge cannot return a live MessagePort).
 * contextIsolation on, nodeIntegration off — enforced in main.
 */
contextBridge.exposeInMainWorld("flowsDesktop", {
  connect(): void {
    const { port1, port2 } = new MessageChannel()
    ipcRenderer.postMessage("flows:connect", null, [port2])
    window.postMessage({ type: "flows-fcp-local-port" }, "*", [port1])
  },
})
