import { existsSync, realpathSync } from "node:fs"
import { platform } from "node:os"

/** Seatbelt profile: deny all writes except under WF_DIR (DES-006). */
export const SANDBOX_PROFILE = `(version 1)
(allow default)
(deny file-write*)
(allow file-write* (subpath (param "WF_DIR")))
(allow file-write-data (literal "/dev/null"))
(allow file-ioctl (literal "/dev/null"))
`

const SANDBOX_EXEC = "/usr/bin/sandbox-exec"

/**
 * Whether macOS sandbox-exec can wrap a task. Set FLOWAPP_SANDBOX=0 to
 * force the unrestricted fallback (warning badge).
 */
export function canApplySandbox(): boolean {
  if (process.env.FLOWAPP_SANDBOX === "0") return false
  return platform() === "darwin" && existsSync(SANDBOX_EXEC)
}

/** Resolve a write-root path for the seatbelt subpath match. */
export function sandboxWriteRoot(workflowRoot: string): string {
  return realpathSync(workflowRoot)
}

export type SandboxSpawn =
  | { sandboxed: true; command: string; args: string[] }
  | { sandboxed: false; command: string; args: string[] }

/**
 * Build the argv for a task shell. When sandboxed, runs under sandbox-exec
 * with writes limited to the workflow dir.
 */
export function buildSandboxSpawn(
  shellCommand: string,
  workflowRoot: string
): SandboxSpawn {
  if (!canApplySandbox()) {
    return { sandboxed: false, command: "/bin/sh", args: ["-c", shellCommand] }
  }
  const wfDir = sandboxWriteRoot(workflowRoot)
  return {
    sandboxed: true,
    command: SANDBOX_EXEC,
    args: [
      "-p",
      SANDBOX_PROFILE,
      "-D",
      `WF_DIR=${wfDir}`,
      "/bin/sh",
      "-c",
      shellCommand,
    ],
  }
}
