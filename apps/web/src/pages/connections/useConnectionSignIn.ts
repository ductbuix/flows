import { useState } from "react"
import {
  connectionBrowserSignInResultSchema,
  connectionCheckResultSchema,
  connectionSignInStatusSchema,
  mcpTrustStatusSchema,
  type ConnectionCheckResult,
} from "@workspace/shared"
import { toast } from "sonner"
import { api } from "@/lib/api"

export type SignInBusy = "sign-in" | "remove" | "check" | "mcp" | null

function serverKeyFromScope(scope: Record<string, string>): string | null {
  const command = scope.command?.trim()
  if (command) return command
  const url = scope.url?.trim()
  if (url) return url
  return null
}

export function useConnectionSignIn(
  connectionId: string,
  onReload: () => Promise<void>
) {
  const [signedIn, setSignedIn] = useState(false)
  const [check, setCheck] = useState<ConnectionCheckResult | null>(null)
  const [busy, setBusy] = useState<SignInBusy>(null)
  const [mcpAlwaysAllowed, setMcpAlwaysAllowed] = useState(false)
  const [mcpDialogOpen, setMcpDialogOpen] = useState(false)

  async function refreshMcpAllowed(scope: Record<string, string>) {
    const key = serverKeyFromScope(scope)
    if (!key) {
      setMcpAlwaysAllowed(false)
      return
    }
    const res = await api["mcp-trust"].$get()
    if (!res.ok) {
      setMcpAlwaysAllowed(false)
      return
    }
    const body = mcpTrustStatusSchema.parse(await res.json())
    setMcpAlwaysAllowed(body.servers.some((s) => s.key === key))
  }

  async function loadSignInState(scope?: Record<string, string>) {
    const [signRes, checkRes] = await Promise.all([
      api.connections[":id"]["sign-in"].$get({
        param: { id: connectionId },
      }),
      api.connections[":id"].check.$post({
        param: { id: connectionId },
      }),
    ])
    if (signRes.ok) {
      setSignedIn(
        connectionSignInStatusSchema.parse(await signRes.json()).signedIn
      )
    }
    if (checkRes.ok) {
      setCheck(connectionCheckResultSchema.parse(await checkRes.json()))
    }
    if (scope) await refreshMcpAllowed(scope)
  }

  async function checkAgain() {
    setBusy("check")
    try {
      const res = await api.connections[":id"].check.$post({
        param: { id: connectionId },
      })
      if (!res.ok) {
        toast.error("Check failed")
        return
      }
      const result = connectionCheckResultSchema.parse(await res.json())
      setCheck(result)
      toast.success(result.ok ? "Sign-in ok" : "Sign-in failed")
      await onReload()
    } catch {
      toast.error("Check failed")
    } finally {
      setBusy(null)
    }
  }

  async function signInWithBrowser() {
    setBusy("sign-in")
    toast.message("Waiting for the browser window to close…")
    try {
      const res = await api.connections[":id"]["sign-in"].browser.$post({
        param: { id: connectionId },
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          message?: string
        } | null
        toast.error(body?.message ?? "Browser sign-in failed")
        return
      }
      const result = connectionBrowserSignInResultSchema.parse(await res.json())
      setSignedIn(result.signedIn)
      setCheck(result.check)
      toast.success(
        result.signedIn ? "Signed in" : "Browser closed with no cookies"
      )
      await onReload()
    } finally {
      setBusy(null)
    }
  }

  async function removeSignIn() {
    setBusy("remove")
    try {
      const res = await api.connections[":id"]["sign-in"].$delete({
        param: { id: connectionId },
      })
      if (!res.ok) {
        toast.error("Could not remove sign-in")
        return
      }
      setSignedIn(false)
      setCheck(null)
      toast.success("Sign-in removed")
      await onReload()
    } finally {
      setBusy(null)
    }
  }

  async function grantMcp(
    key: string,
    grant: "once" | "always",
    scope: Record<string, string>
  ) {
    setBusy("mcp")
    try {
      const res = await api["mcp-trust"].$put({
        json: { key, grant },
      })
      if (!res.ok) {
        toast.error("Could not update MCP allow")
        return
      }
      setMcpDialogOpen(false)
      if (grant === "always") {
        setMcpAlwaysAllowed(true)
        toast.success("MCP server always allowed")
      } else {
        toast.success("MCP server allowed once")
      }
      await checkAgain()
      await refreshMcpAllowed(scope)
      await onReload()
    } finally {
      setBusy(null)
    }
  }

  async function revokeMcp(key: string, scope: Record<string, string>) {
    setBusy("mcp")
    try {
      const res = await api["mcp-trust"].$put({
        json: { key, grant: "none" },
      })
      if (!res.ok) {
        toast.error("Could not revoke MCP allow")
        return
      }
      setMcpAlwaysAllowed(false)
      toast.success("MCP allow revoked")
      await checkAgain()
      await refreshMcpAllowed(scope)
      await onReload()
    } finally {
      setBusy(null)
    }
  }

  return {
    signedIn,
    check,
    busy,
    mcpAlwaysAllowed,
    mcpDialogOpen,
    setMcpDialogOpen,
    loadSignInState,
    checkAgain,
    signInWithBrowser,
    removeSignIn,
    grantMcp,
    revokeMcp,
  }
}
