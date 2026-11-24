import { z } from "zod"
import { defineNodeKind } from "./define.ts"

/** Waits for a person; Approve forwards the input, Reject stops the run (DES-032). */
export const approvalKind = defineNodeKind({
  kind: "approval",
  group: "flow",
  ports: { in: ["text", "file"], out: ["text", "file"] },
  settings: {
    question: z.string().min(1),
  },
})
