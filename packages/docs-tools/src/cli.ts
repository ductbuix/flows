// Usage: tsx src/cli.ts index|check [docsDir]
import { resolve } from "node:path"
import { run } from "./docs.ts"

const mode = process.argv[2]
if (mode !== "check" && mode !== "index") {
  console.error("usage: docs index|check [docsDir]")
  process.exit(2)
}
const docsDir = resolve(
  process.argv[3] ?? resolve(import.meta.dirname, "../../../docs")
)
const { docs, errors } = run(docsDir, mode)
if (errors.length) {
  console.error(
    `docs: ${errors.length} problem(s)\n${errors.map((e) => `  ${e}`).join("\n")}`
  )
  process.exit(1)
}
console.log(
  `docs: ${docs.length} docs ok${mode === "index" ? ", indexes written" : ""}`
)
