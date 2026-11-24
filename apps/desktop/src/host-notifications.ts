import { BrowserWindow, Notification } from "electron"

export type InboxNotifyPayload = {
  title: string
  body: string
}

/** OS notification for a new Inbox item when no window is focused (BL-189). */
export function notifyInboxIfUnfocused(payload: InboxNotifyPayload): void {
  const focused = BrowserWindow.getFocusedWindow()
  if (focused) return
  if (!Notification.isSupported()) return
  new Notification({
    title: payload.title,
    body: payload.body,
  }).show()
}
