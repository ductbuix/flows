import { z } from "zod"
import { workflowInputDeclSchema } from "../workflow.ts"
import { defineNodeKind } from "./define.ts"

export const triggerKind = defineNodeKind({
  kind: "trigger",
  group: "inputs",
  ports: { in: [], out: ["text", "file"] },
  settings: {
    type: z.literal("manual"),
    inputs: z.array(workflowInputDeclSchema).optional(),
  },
})
