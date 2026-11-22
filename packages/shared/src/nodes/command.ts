import { z } from "zod"
import { stepSettings } from "./common.ts"
import { defineNodeKind } from "./define.ts"

export const commandKind = defineNodeKind({
  kind: "command",
  group: "steps",
  ports: { in: ["text", "file"], out: ["text", "file"] },
  process: "shell",
  settings: {
    run: z.string().min(1),
    ...stepSettings,
  },
})
