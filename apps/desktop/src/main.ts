import {
  app,
  BrowserWindow,
  ipcMain,
  utilityProcess,
  type UtilityProcess,
} from "electron"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const preloadPath = join(here, "preload.cjs")
const engineHostPath = join(here, "engine-host.cjs")

function webDistDir(): string {
  return process.env.FLOWAPP_WEB_DIST ?? join(here, "../../web/dist")
}

let engineChild: UtilityProcess | undefined

function startEngineHost(): UtilityProcess {
  const home = process.env.FLOWAPP_HOME
  if (!home) {
    throw new Error("FLOWAPP_HOME is required")
  }
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
  void win.loadFile(join(dist, "index.html"), { hash: "/mock/docket" })
  return win
}

app.whenReady().then(() => {
  engineChild = startEngineHost()

  ipcMain.on("flows:connect", (event) => {
    const port = event.ports[0]
    if (!port || !engineChild) return
    engineChild.postMessage({ type: "connect" }, [port])
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
  engineChild?.kill()
  engineChild = undefined
})
