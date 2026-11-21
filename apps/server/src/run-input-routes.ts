import { zValidator } from "@hono/zod-validator"
import type { Engine } from "@workspace/engine"
import {
  inputsJsonSchema,
  outListSchema,
  runInputFileDetailSchema,
  type InputsJson,
  type OutList,
  type RunInputFileDetail,
} from "@workspace/shared"
import { Hono } from "hono"
import { z } from "zod"
import {
  listRunInputFiles,
  readRunInputBytes,
  readRunInputTextFile,
  readRunInputsJson,
} from "./run-input-files.ts"

const runParam = z.object({ runId: z.string().min(1) })
const fileParam = z.object({
  runId: z.string().min(1),
  path: z.string().min(1),
})
const fileQuery = z.object({
  download: z.enum(["1", "true"]).optional(),
})

/** List, meta, and read frozen run input files (DES-021). */
export function runInputRoutes(engine: Engine) {
  return new Hono()
    .get("/runs/:runId/input", zValidator("param", runParam), (c) => {
      const { runId } = c.req.valid("param")
      const listed = listRunInputFiles(engine, runId)
      if (!listed) return c.json({ message: "run not found" }, 404)
      return c.json(outListSchema.parse(listed) satisfies OutList, 200)
    })
    .get("/runs/:runId/input/meta", zValidator("param", runParam), (c) => {
      const { runId } = c.req.valid("param")
      const meta = readRunInputsJson(engine, runId)
      if (!meta) return c.json({ message: "not found" }, 404)
      return c.json(inputsJsonSchema.parse(meta) satisfies InputsJson, 200)
    })
    .get(
      "/runs/:runId/input/files/:path{.+}",
      zValidator("param", fileParam),
      zValidator("query", fileQuery),
      (c) => {
        const { runId, path: rel } = c.req.valid("param")
        const { download } = c.req.valid("query")
        if (download) {
          const file = readRunInputBytes(engine, runId, rel)
          if (!file) return c.json({ message: "not found" }, 404)
          const name = rel.split("/").pop() ?? "download"
          return new Response(new Uint8Array(file.data), {
            status: 200,
            headers: {
              "content-type": "application/octet-stream",
              "content-disposition": `attachment; filename="${name}"`,
            },
          })
        }
        const detail = readRunInputTextFile(engine, runId, rel)
        if (!detail) return c.json({ message: "not found" }, 404)
        return c.json(
          runInputFileDetailSchema.parse(detail) satisfies RunInputFileDetail,
          200
        )
      }
    )
}
