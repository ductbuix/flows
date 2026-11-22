import { zValidator } from "@hono/zod-validator"
import type { Engine } from "@workspace/engine"
import { markNoticesReadBodySchema, noticeListSchema } from "@workspace/shared"
import { Hono } from "hono"

/** GET /notices and POST /notices/read: the in-app notice bell (BL-100). */
export function noticeRoutes(engine: Engine) {
  return new Hono()
    .get("/notices", (c) =>
      c.json(noticeListSchema.parse(engine.listNotices()), 200)
    )
    .post(
      "/notices/read",
      zValidator("json", markNoticesReadBodySchema),
      (c) => {
        engine.markNoticesRead(c.req.valid("json").ids)
        return c.json(noticeListSchema.parse(engine.listNotices()), 200)
      }
    )
}
