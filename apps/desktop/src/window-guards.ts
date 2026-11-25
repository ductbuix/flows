import type { BrowserWindow, Session } from "electron"

/** Origins the main window may stay on: the bundled app and blob scheme. */
export function isAllowedNavigation(
  target: string,
  appUrl: string,
  devOrigin?: string
): boolean {
  let url: URL
  try {
    url = new URL(target)
  } catch {
    return false
  }
  if (url.protocol === "file:") {
    // Same bundle only; hash changes are in-app routing.
    return url.pathname === new URL(appUrl).pathname
  }
  return devOrigin !== undefined && url.origin === devOrigin
}

/** Deny pop-ups and navigation away from the app; no external loads. */
export function lockDownWindow(
  win: BrowserWindow,
  appUrl: string,
  devOrigin?: string
): void {
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }))
  win.webContents.on("will-navigate", (event, url) => {
    if (!isAllowedNavigation(url, appUrl, devOrigin)) event.preventDefault()
  })
  win.webContents.on("will-attach-webview", (event) => event.preventDefault())
}

/** Renderer asks for no device permissions; notifications run in main. */
export function denyAllPermissions(session: Session): void {
  session.setPermissionRequestHandler((_wc, _permission, callback) =>
    callback(false)
  )
  session.setPermissionCheckHandler(() => false)
}
