import { timingSafeEqual } from "node:crypto"
import type { BlobStore } from "@workspace/core"
import { getBlobStore } from "@workspace/engine"
import { Hono } from "hono"
import { stream } from "hono/streaming"
import { z } from "zod"

function tokenMatches(provided: string | undefined, expected: string): boolean {
  if (provided == null) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

const putQuery = z.object({
  token: z.string().min(1),
  scope: z.string().min(1),
  name: z.string().min(1).optional(),
})

const getQuery = z.object({
  token: z.string().min(1),
})

/**
 * GET/PUT /blobs with the engine lock token (DES-040 Blobs).
 * Mount at the daemon root, not under /api.
 */
export function blobRoutes(
  token: string,
  store: BlobStore = getBlobStore()
): Hono {
  return new Hono()
    .put("/", async (c) => {
      const parsed = putQuery.safeParse({
        token: c.req.query("token"),
        scope: c.req.query("scope"),
        name: c.req.query("name") ?? undefined,
      })
      if (!parsed.success) return c.json({ message: "bad request" }, 400)
      if (!tokenMatches(parsed.data.token, token)) {
        return c.json({ message: "unauthorized" }, 401)
      }
      const body = c.req.raw.body
      if (!body) return c.json({ message: "empty body" }, 400)
      const mime =
        c.req.header("content-type")?.split(";")[0]?.trim() ||
        "application/octet-stream"
      const ref = await store.put(parsed.data.scope, body, {
        name: parsed.data.name,
        mime,
      })
      return c.json(ref, 200)
    })
    .get("/:id", async (c) => {
      const parsed = getQuery.safeParse({ token: c.req.query("token") })
      if (!parsed.success) return c.json({ message: "bad request" }, 400)
      if (!tokenMatches(parsed.data.token, token)) {
        return c.json({ message: "unauthorized" }, 401)
      }
      const id = c.req.param("id")
      const opened = await store.open(id)
      if (!opened) return c.json({ message: "not found" }, 404)
      return stream(c, async (s) => {
        const reader = opened.getReader()
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          if (value) await s.write(value)
        }
      })
    })
}
