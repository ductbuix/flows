import { zValidator } from "@hono/zod-validator"
import { listLibrary, pullNow, type Engine } from "@workspace/engine"
import {
  libraryListSchema,
  libraryPullBodySchema,
  libraryPullResultSchema,
  type LibraryList,
  type LibraryPullResult,
} from "@workspace/shared"
import { Hono } from "hono"

/** GET /library and POST /library/pull (DES-026 / BL-043). */
export function libraryRoutes(engine: Engine) {
  return new Hono()
    .get("/library", (c) => {
      const body: LibraryList = listLibrary(engine.home)
      return c.json(libraryListSchema.parse(body), 200)
    })
    .post(
      "/library/pull",
      zValidator("json", libraryPullBodySchema),
      async (c) => {
        const body = c.req.valid("json")
        try {
          const { result, event } = await pullNow({
            home: engine.home,
            connectionId: body.connection,
            kind: body.kind,
            entityId: body.entityId,
          })
          engine.appendLibraryEvent(event)
          return c.json(
            libraryPullResultSchema.parse(result) satisfies LibraryPullResult,
            200
          )
        } catch (err) {
          const message = err instanceof Error ? err.message : "pull failed"
          const status = /unknown connection/.test(message) ? 404 : 400
          return c.json({ message }, status)
        }
      }
    )
}
