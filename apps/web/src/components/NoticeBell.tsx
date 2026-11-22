import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router"
import { Bell } from "lucide-react"
import {
  noticeListSchema,
  wsServerMessageSchema,
  type NoticeList,
} from "@workspace/shared"
import { Button } from "@workspace/ui/components/button"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import {
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar"
import { api } from "@/lib/api"
import { runPath } from "@/lib/paths"
import { apiWebSocketUrl } from "@/lib/ws-url"

/** Loads GET /notices and reloads when a run changes (a notify step posts). */
function useNotices() {
  const [list, setList] = useState<NoticeList>({ notices: [], unread: 0 })

  const reload = useCallback(async () => {
    const res = await api.notices.$get()
    if (!res.ok) return
    setList(noticeListSchema.parse(await res.json()))
  }, [])

  useEffect(() => {
    let alive = true
    const safe = () => {
      if (alive) void reload().catch(() => undefined)
    }
    safe()
    const ws = new WebSocket(apiWebSocketUrl())
    ws.addEventListener("message", (evt) => {
      let json: unknown
      try {
        json = JSON.parse(String(evt.data))
      } catch {
        return
      }
      const parsed = wsServerMessageSchema.safeParse(json)
      if (parsed.success && parsed.data.type === "runs_changed") safe()
    })
    return () => {
      alive = false
      ws.close()
    }
  }, [reload])

  const markRead = useCallback(async (ids?: number[]) => {
    const res = await api.notices.read.$post({ json: ids ? { ids } : {} })
    if (res.ok) setList(noticeListSchema.parse(await res.json()))
  }, [])

  return { list, markRead }
}

/** Sidebar bell: unread count and the latest notices (BL-100). */
export function NoticeBell() {
  const { list, markRead } = useNotices()
  const { notices, unread } = list

  return (
    <SidebarMenuItem>
      <Popover>
        <PopoverTrigger
          render={
            <SidebarMenuButton data-testid="notice-bell" tooltip="Notices" />
          }
        >
          <Bell />
          <span>Notices</span>
        </PopoverTrigger>
        {unread > 0 ? (
          <SidebarMenuBadge data-testid="notice-unread">{unread}</SidebarMenuBadge>
        ) : null}
        <PopoverContent
          side="right"
          align="end"
          className="w-80"
          data-testid="notice-panel"
        >
          <PopoverHeader className="flex-row items-center justify-between">
            <PopoverTitle>Notices</PopoverTitle>
            <Button
              variant="ghost"
              size="sm"
              data-testid="notice-mark-all"
              disabled={unread === 0}
              onClick={() => void markRead()}
            >
              Mark all read
            </Button>
          </PopoverHeader>
          {notices.length === 0 ? (
            <p className="text-muted-foreground" data-testid="notice-empty">
              No notices yet. An Output node set to Notify posts here.
            </p>
          ) : (
            <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
              {notices.map((n) => (
                <li key={n.id}>
                  <Link
                    to={runPath(n.runId)}
                    data-testid="notice-item"
                    data-read={n.read ? "true" : "false"}
                    onClick={() => {
                      if (!n.read) void markRead([n.id])
                    }}
                    className="flex flex-col gap-0.5 rounded-md px-2 py-1.5 hover:bg-muted"
                  >
                    <span
                      className={
                        n.read ? "text-muted-foreground" : "font-medium"
                      }
                    >
                      {n.title}
                    </span>
                    {n.text ? (
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        {n.text}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </PopoverContent>
      </Popover>
    </SidebarMenuItem>
  )
}
