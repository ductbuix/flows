import { chmodSync, copyFileSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

/**
 * Stub `claude` and fake Cursor ACP `agent` on PATH, under `<home>/bin`.
 * The stub `claude` answers yes so Judge runs need no real CLI.
 */
export function seedFakeCli(home: string): void {
  // A `claude` on PATH that answers yes, so Judge runs need no real CLI. A
  // rule that starts `until-pass N` answers No while the step is before pass N.
  const bin = join(home, "bin")
  mkdirSync(bin, { recursive: true })
  writeFileSync(
    join(bin, "claude"),
    [
      "#!/bin/sh",
      // An LLM call (tools off) prints a line made from the first prompt line.
      // An LLM call that asks for answers gets a fixed JSON block back (BL-085).
      'case "$*" in *--tools*) p=$(cat); case "$p" in *"## Answer"*) printf \'```json\\n{"risk":"high","score":3}\\n```\\n\'; exit 0;; esac; echo "Summary: $(printf %s "$p" | head -1)"; exit 0;; esac',
      "n=$(sed -n 's/^until-pass \\([0-9]*\\)$/\\1/p' input/rule.md 2>/dev/null | head -1)",
      "p=$(printf %s \"$PWD\" | sed -n 's/.*pass-\\([0-9]*\\)\\/attempt.*/\\1/p')",
      'if [ -n "$n" ] && [ -n "$p" ] && [ "$p" -lt "$n" ]; then echo no; else echo yes; fi',
      "",
    ].join("\n"),
    { mode: 0o755 }
  )
  // Fake Cursor ACP agent on PATH (BL-142); used when agents.runtime=acp.
  const agentBin = join(bin, "agent")
  copyFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "fake-acp-agent.mjs"),
    agentBin
  )
  chmodSync(agentBin, 0o755)
}

/** Stub `gh` for library pull/push (BL-204 / BL-205). */
export function seedGhStub(home: string): void {
  const bin = join(home, "bin")
  writeFileSync(
    join(bin, "gh"),
    [
      "#!/bin/sh",
      'if [ "$1" = "--version" ]; then echo "gh stub 0.0.0"; exit 0; fi',
      'if [ "$1" = "repo" ] && [ "$2" = "push" ]; then',
      '  printf \'{"note":"Stub push"}\\n\'',
      "  exit 0",
      "fi",
      'n=$(($(cat "$FLOWAPP_HOME/.gh-pull-n" 2>/dev/null || echo 0) + 1))',
      'echo "$n" > "$FLOWAPP_HOME/.gh-pull-n"',
      'printf \'{"files":{"README.md":"pull-%s"},"note":"Stub fetch %s"}\\n\' "$n" "$n"',
      "exit 0",
      "",
    ].join("\n"),
    { mode: 0o755 }
  )
}
