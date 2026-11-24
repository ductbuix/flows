import {
  app,
  BrowserWindow,
  ipcMain,
  utilityProcess,
  type UtilityProcess,
} from "electron"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { resolveAppHome } from "@workspace/adapters-node"
import { bridgePortToWebSocket } from "./fcp-bridge.ts"
import { notifyInboxIfUnfocused, notifySystem } from "./host-notifications.ts"
import { openBrowserSignIn } from "./host-browser-sign-in.ts"
import { revealPathInFolder } from "./host-shell.ts"
import {
  installFlowsBlobProtocol,
  registerFlowsBlobScheme,
} from "./install-flows-blob.ts"
import { resolveEngineMode, type EngineMode } from "./resolve-engine-mode.ts"
import type { MessagePortLike } from "@workspace/protocol"

const here = dirname(fileURLToPath(import.meta.url))
const preloadPath = join(here, "preload.cjs")
const engineHostPath = join(here, "engine-host.cjs")

registerFlowsBlobScheme()

function webDistDir(): string {
  return process.env.FLOWAPP_WEB_DIST ?? join(here, "../../web/dist")
}

let engineChild: UtilityProcess | undefined
let engineMode: EngineMode | undefined
const bridges: Array<{ dispose: () => void }> = []

function startEngineHost(): UtilityProcess {
  const home = resolveAppHome()
  const child = utilityProcess.fork(engineHostPath, [], {
    env: { ...process.env, FLOWAPP_HOME: home },
    serviceName: "flows-engine",
  })
  child.on("exit", (code) => {
    if (code !== 0) {
      console.error(`engine-host exited with code ${code}`)
    }
  })
  return child
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  const dist = webDistDir()
  void win.loadFile(join(dist, "index.html"), { hash: "/docket" })
  return win
}

app.whenReady().then(() => {
  const home = resolveAppHome()

  installFlowsBlobProtocol(home)

  engineMode = resolveEngineMode(home)
  if (engineMode.kind === "busy") {
    throw new Error(`FLOWAPP_HOME engine busy, pid ${engineMode.pid}`)
  }
  if (engineMode.kind === "own") {
    engineChild = startEngineHost()
  }

  ipcMain.on("flows:connect", (event) => {
    const port = event.ports[0]
    if (!port || !engineMode) return

    if (engineMode.kind === "own") {
      if (!engineChild) return
      engineChild.postMessage({ type: "connect" }, [port])
      return
    }

    if (engineMode.kind !== "attach") return

    bridges.push(
      bridgePortToWebSocket(
        port as unknown as MessagePortLike,
        engineMode.url,
        engineMode.token
      )
    )
  })

  ipcMain.on("flows:reveal-path", (_event, path: unknown) => {
    if (typeof path !== "string" || path.length === 0) return
    revealPathInFolder(path)
  })

  ipcMain.on("flows:notify-inbox", (_event, payload: unknown) => {
    if (!payload || typeof payload !== "object") return
    const { title, body } = payload as { title?: unknown; body?: unknown }
    if (typeof title !== "string" || typeof body !== "string") return
    notifyInboxIfUnfocused({ title, body })
  })

  ipcMain.on("flows:notify-system", (_event, payload: unknown) => {
    if (!payload || typeof payload !== "object") return
    const { title, body } = payload as { title?: unknown; body?: unknown }
    if (typeof title !== "string" || typeof body !== "string") return
    notifySystem({ title, body })
  })

  ipcMain.handle("flows:browser-sign-in", async (_event, raw: unknown) => {
    if (!raw || typeof raw !== "object") {
      return { cancelled: true as const }
    }
    const params = raw as {
      connectorId?: unknown
      url?: unknown
      cookieDomains?: unknown
    }
    if (
      typeof params.connectorId !== "string" ||
      typeof params.url !== "string" ||
      !Array.isArray(params.cookieDomains) ||
      !params.cookieDomains.every((d) => typeof d === "string")
    ) {
      return { cancelled: true as const }
    }
    return openBrowserSignIn({
      connectorId: params.connectorId,
      url: params.url,
      cookieDomains: params.cookieDomains,
    })
  })

  createWindow()

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})

app.on("before-quit", () => {
  for (const b of bridges.splice(0)) b.dispose()
  engineChild?.kill()
  engineChild = undefined
})
