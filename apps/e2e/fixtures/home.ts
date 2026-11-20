import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const diamondYaml = `id: diamond
goal: e2e diamond fixture
tasks:
  - id: a
    kind: command
    run: >-
      printf 'HELLO_STDOUT\\n' &&
      printf '# Report\\n\\n| col |\\n| --- |\\n| x |\\n' > "$(dirname "$TASK_OUT")/SUMMARY.md" &&
      printf a > "$TASK_OUT/letter.txt"
  - id: b
    kind: command
    run: "printf b > \\"$TASK_OUT/letter.txt\\""
    needs: [a]
  - id: c
    kind: command
    run: "printf c > \\"$TASK_OUT/letter.txt\\""
    needs: [a]
  - id: d
    kind: command
    run: "printf done > \\"$TASK_OUT/out.txt\\""
    needs: [b, c]
`

const failRetryYaml = `id: fail-retry
goal: e2e retry badge
tasks:
  - id: flaky
    kind: command
    run: "exit 1"
    retry: { max: 2 }
`

/** Create a temp FLOWAPP_HOME with e2e workflow fixtures. */
export function createE2eHome(): string {
  const home = mkdtempSync(join(tmpdir(), "flowapp-e2e-"))
  for (const [id, yaml] of [
    ["diamond", diamondYaml],
    ["fail-retry", failRetryYaml],
  ] as const) {
    const dir = join(home, "workflows", id)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, "workflow.yaml"), yaml)
  }
  return home
}
