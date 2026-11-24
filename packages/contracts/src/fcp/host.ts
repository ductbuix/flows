import { z } from "zod"
import { defineMethod } from "./define.ts"

/** Engine → client: show a path in Finder (DES-040 `host.revealPath`). */
export const hostRevealPathParamsSchema = z.object({
  path: z.string().min(1),
})

export const hostRevealPathResultSchema = z.object({})

export const hostRevealPathMethod = defineMethod({
  name: "host/reveal_path",
  params: hostRevealPathParamsSchema,
  result: hostRevealPathResultSchema,
  kind: "command",
})

/** Engine-to-client host methods (not in `fcpMethodTable`). */
export const fcpHostMethodTable = {
  "host/reveal_path": hostRevealPathMethod,
} as const
