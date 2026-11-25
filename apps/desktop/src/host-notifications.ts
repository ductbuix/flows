import { BrowserWindow, Notification } from "electron"

export type InboxNotifyPayload = {
  title: string
  body: string
}

/** OS notification for a new Inbox item when no window is focused (BL-189). */
export function notifyInboxIfUnfocused(payload: InboxNotifyPayload): void {
  const focused = BrowserWindow.getFocusedWindow()
  if (focused) return
  notifySystem(payload)
}

/**
 * OS notification for an Output notify step with `channel: system`; shows
 * even when the app is focused, since the workflow asked for it.
 */
export function notifySystem(payload: InboxNotifyPayload): void {
  if (!Notification.isSupported()) return
  new Notification({
    title: payload.title,
    body: payload.body,
  }).show()
}
