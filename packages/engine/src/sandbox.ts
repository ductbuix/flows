import { existsSync, mkdirSync, realpathSync } from "node:fs"
import { homedir, platform } from "node:os"
import { dirname, join } from "node:path"

/**
 * Seatbelt profile: deny writes except under WF_DIR, deny reads under
 * SECRETS_DIR, and optionally allow writes under CURSOR_HOME (Cursor
 * writes projects/, chats/, and related state under ~/.cursor even with
 * --trust; BL-018 live check).
 */
export const SANDBOX_PROFILE = `(version 1)
(allow default)
(deny file-write*)
(allow file-write* (subpath (param "WF_DIR")))
(allow file-write-data (literal "/dev/null"))
(allow file-ioctl (literal "/dev/null"))
(deny file-read* (subpath (param "SECRETS_DIR")))
`

export const SANDBOX_PROFILE_WITH_CURSOR = `${SANDBOX_PROFILE}
(allow file-write* (subpath (param "CURSOR_HOME")))
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

/**
 * Secrets root for the seatbelt deny. Workflows live at
 * `<home>/workflows/<id>`; secrets at `<home>/secrets`.
 */
export function sandboxSecretsRoot(workflowRoot: string): string {
  const home = dirname(dirname(workflowRoot))
  const secrets = join(home, "secrets")
  mkdirSync(secrets, { recursive: true })
  return realpathSync(secrets)
}

export type SandboxSpawn =
  | { sandboxed: true; command: string; args: string[] }
  | { sandboxed: false; command: string; args: string[] }

export type SandboxSpawnOptions = {
  /** Allow writes under ~/.cursor (agent cursor tasks; BL-018). */
  allowCursorHome?: boolean
  /** Narrows the write root below the workflow, e.g. to one attempt (LLM node). */
  writeRoot?: string
}

/**
 * Build the argv for a task shell. When sandboxed, runs under sandbox-exec
 * with writes limited to the workflow dir and secrets/ unreadable.
 */
export function buildSandboxSpawn(
  shellCommand: string,
  workflowRoot: string,
  options: SandboxSpawnOptions = {}
): SandboxSpawn {
  if (!canApplySandbox()) {
    return { sandboxed: false, command: "/bin/sh", args: ["-c", shellCommand] }
  }
  const wfDir = sandboxWriteRoot(options.writeRoot ?? workflowRoot)
  const secretsDirPath = sandboxSecretsRoot(workflowRoot)
  const baseArgs = [
    "-p",
    options.allowCursorHome ? SANDBOX_PROFILE_WITH_CURSOR : SANDBOX_PROFILE,
    "-D",
    `WF_DIR=${wfDir}`,
    "-D",
    `SECRETS_DIR=${secretsDirPath}`,
  ]
  if (options.allowCursorHome) {
    const cursorHome = join(homedir(), ".cursor")
    mkdirSync(cursorHome, { recursive: true })
    const cursorRoot = realpathSync(cursorHome)
    return {
      sandboxed: true,
      command: SANDBOX_EXEC,
      args: [
        ...baseArgs,
        "-D",
        `CURSOR_HOME=${cursorRoot}`,
        "/bin/sh",
        "-c",
        shellCommand,
      ],
    }
  }
  return {
    sandboxed: true,
    command: SANDBOX_EXEC,
    args: [...baseArgs, "/bin/sh", "-c", shellCommand],
  }
}
