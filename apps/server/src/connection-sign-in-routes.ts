import { zValidator } from "@hono/zod-validator"
import {
  BrowserSignInError,
  getConnector,
  isSignedIn,
  readConnection,
  removeSignIn,
  signInWithBrowser,
  type Engine,
} from "@workspace/engine"
import {
  connectionBrowserSignInResultSchema,
  connectionParamSchema,
  connectionSignInStatusSchema,
  type Connection,
  type ConnectionBrowserSignInResult,
  type ConnectionCheckResult,
  type ConnectionSignInStatus,
} from "@workspace/shared"
import { Hono } from "hono"

async function runCheck(
  engine: Engine,
  conn: Connection
): Promise<ConnectionCheckResult | { error: string; status: 400 }> {
  const connector = getConnector(conn.connector)
  if (!connector) {
    return { error: "unknown_connector", status: 400 }
  }
  return connector.check(conn, engine.home)
}

/** Cookie sign-in status, browser launch and remove (DES-026 / BL-053). */
export function connectionSignInRoutes(engine: Engine) {
  return new Hono()
    .get(
      "/connections/:id/sign-in",
      zValidator("param", connectionParamSchema),
      (c) => {
        const { id } = c.req.valid("param")
        const conn = readConnection(engine.home, id)
        if (!conn) return c.json({ message: "not_found" }, 404)
        const body: ConnectionSignInStatus = {
          signedIn: isSignedIn(engine.home, id),
        }
        return c.json(connectionSignInStatusSchema.parse(body), 200)
      }
    )
    .post(
      "/connections/:id/sign-in/browser",
      zValidator("param", connectionParamSchema),
      async (c) => {
        const { id } = c.req.valid("param")
        const conn = readConnection(engine.home, id)
        if (!conn) return c.json({ message: "not_found" }, 404)
        if (conn.signIn !== "cookies") {
          return c.json(
            { message: "sign_in_not_cookies", signIn: conn.signIn },
            400
          )
        }
        try {
          await signInWithBrowser(engine.home, conn)
        } catch (err) {
          const message =
            err instanceof BrowserSignInError
              ? err.message
              : err instanceof Error
                ? err.message
                : "browser sign-in failed"
          return c.json({ message }, 400)
        }
        const check = await runCheck(engine, conn)
        if ("error" in check) {
          return c.json(
            { message: check.error, connector: conn.connector },
            check.status
          )
        }
        const body: ConnectionBrowserSignInResult = {
          signedIn: isSignedIn(engine.home, id),
          check,
        }
        return c.json(connectionBrowserSignInResultSchema.parse(body), 200)
      }
    )
    .delete(
      "/connections/:id/sign-in",
      zValidator("param", connectionParamSchema),
      (c) => {
        const { id } = c.req.valid("param")
        const conn = readConnection(engine.home, id)
        if (!conn) return c.json({ message: "not_found" }, 404)
        removeSignIn(engine.home, id)
        return c.body(null, 204)
      }
    )
}
