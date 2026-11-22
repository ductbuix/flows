import { defineNodeKind } from "./define.ts"

export const promptKind = defineNodeKind({
  kind: "prompt",
  group: "inputs",
  ports: { in: [], out: ["text"] },
  files: [{ path: "text.md", required: true }],
  settings: {},
})
