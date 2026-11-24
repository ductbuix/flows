import { execFile } from "node:child_process"
import { promisify } from "node:util"
import type { CliInfo } from "@workspace/contracts"
import type { CliStatusPort } from "@workspace/core"

const execFileAsync = promisify(execFile)

const CLI_PROBES: ReadonlyArray<{
  id: CliInfo["id"]
  bin: string
  args: string[]
}> = [
  { id: "claude", bin: "claude", args: ["--version"] },
  { id: "cursor", bin: "agent", args: ["--version"] },
]

async function probeVersion(
  bin: string,
  args: string[]
): Promise<string | null> {
  try {
    const { stdout, stderr } = await execFileAsync(bin, args, {
      timeout: 5000,
      encoding: "utf8",
    })
    const text = `${stdout}${stderr}`.trim().split("\n")[0]?.trim()
    return text || null
  } catch {
    return null
  }
}

/** PATH probe for agent CLIs (BL-210). */
export function createNodeCliStatusPort(): CliStatusPort {
  return {
    async listCliStatus() {
      return Promise.all(
        CLI_PROBES.map(async ({ id, bin, args }) => {
          const version = await probeVersion(bin, args)
          return { id, installed: Boolean(version), version }
        })
      )
    },
  }
}
