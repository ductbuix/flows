import { beforeEach, describe, expect, it, vi } from "vitest"

const getFocusedWindow = vi.fn()
const show = vi.fn()
const isSupported = vi.fn(() => true)

vi.mock("electron", () => ({
  BrowserWindow: { getFocusedWindow },
  Notification: Object.assign(
    vi.fn(function NotificationMock(this: { show: () => void }) {
      this.show = show
    }),
    { isSupported }
  ),
}))

describe("notifyInboxIfUnfocused", () => {
  beforeEach(() => {
    getFocusedWindow.mockReset()
    show.mockReset()
    isSupported.mockReturnValue(true)
    vi.resetModules()
  })

  it("skips when a window is focused", async () => {
    getFocusedWindow.mockReturnValue({})
    const { notifyInboxIfUnfocused } = await import("./host-notifications.ts")
    notifyInboxIfUnfocused({ title: "t", body: "b" })
    expect(show).not.toHaveBeenCalled()
  })

  it("shows when no window is focused", async () => {
    getFocusedWindow.mockReturnValue(null)
    const { notifyInboxIfUnfocused } = await import("./host-notifications.ts")
    notifyInboxIfUnfocused({ title: "Approval needed", body: "Ship it?" })
    expect(show).toHaveBeenCalledOnce()
  })
})
