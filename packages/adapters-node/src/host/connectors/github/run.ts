import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

export type CommandResult = {
  stdout: string
  stderr: string
  code: number
}

export type GithubRunner = {
  runGh: (args: string[]) => Promise<CommandResult>
  runGit: (args: string[]) => Promise<string>
}

/** Run `gh` and capture stdout/stderr even on non-zero exit. */
export async function runGh(args: string[]): Promise<CommandResult> {
  try {
    const { stdout, stderr } = await execFileAsync("gh", args, {
      timeout: 15_000,
      encoding: "utf8",
    })
    return { stdout: stdout ?? "", stderr: stderr ?? "", code: 0 }
  } catch (err) {
    const e = err as {
      code?: string | number
      stdout?: string
      stderr?: string
      message?: string
    }
    if (e.code === "ENOENT") {
      return { stdout: "", stderr: "ENOENT: gh not found", code: 127 }
    }
    const code = typeof e.code === "number" ? e.code : 1
    return {
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? e.message ?? "",
      code,
    }
  }
}

/** Run `git` and return stdout; throw on failure. */
export async function runGit(args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", args, {
      timeout: 120_000,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    })
    return stdout ?? ""
  } catch (err) {
    const e = err as { stderr?: string; message?: string }
    throw new Error(e.stderr?.trim() || e.message || "git failed", {
      cause: err,
    })
  }
}
