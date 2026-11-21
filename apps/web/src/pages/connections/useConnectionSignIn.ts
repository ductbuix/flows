import { useState } from "react"
import {
  connectionBrowserSignInResultSchema,
  connectionCheckResultSchema,
  connectionSignInStatusSchema,
  type ConnectionCheckResult,
} from "@workspace/shared"
import { toast } from "sonner"
import { api } from "@/lib/api"

export type SignInBusy = "sign-in" | "remove" | "check" | null

export function useConnectionSignIn(
  connectionId: string,
  onReload: () => Promise<void>
) {
  const [signedIn, setSignedIn] = useState(false)
  const [check, setCheck] = useState<ConnectionCheckResult | null>(null)
  const [busy, setBusy] = useState<SignInBusy>(null)

  async function loadSignInState() {
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

  return {
    signedIn,
    check,
    busy,
    loadSignInState,
    checkAgain,
    signInWithBrowser,
    removeSignIn,
  }
}
