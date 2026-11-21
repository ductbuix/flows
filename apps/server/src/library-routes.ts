import { zValidator } from "@hono/zod-validator"
import {
  clearEntityRevisions,
  LibraryCapError,
  listLibrary,
  pullNow,
  type Engine,
} from "@workspace/engine"
import {
  libraryClearBodySchema,
  libraryClearResultSchema,
  libraryListSchema,
  libraryPullBodySchema,
  libraryPullResultSchema,
  type LibraryClearResult,
  type LibraryList,
  type LibraryPullResult,
} from "@workspace/shared"
import { Hono } from "hono"

/** GET /library, POST /library/pull, POST /library/clear (DES-026). */
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
          if (err instanceof LibraryCapError) {
            return c.json({ message: err.message, code: err.code }, 507)
          }
          const message = err instanceof Error ? err.message : "pull failed"
          const status = /unknown connection/.test(message) ? 404 : 400
          return c.json({ message }, status)
        }
      }
    )
    .post("/library/clear", zValidator("json", libraryClearBodySchema), (c) => {
      const body = c.req.valid("json")
      const result = clearEntityRevisions(
        engine.home,
        body.connection,
        body.kind,
        body.entityId
      )
      return c.json(
        libraryClearResultSchema.parse(result) satisfies LibraryClearResult,
        200
      )
    })
}
