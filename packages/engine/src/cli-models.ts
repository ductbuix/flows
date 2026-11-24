import { homedir } from "node:os"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { EFFORTS, type CliModelCatalog, type Effort } from "@workspace/contracts"
import type { CliKind } from "./cli-adapters.ts"
import {
  parseCursorModelList,
  type ListedCursorModel,
} from "./cursor-model-families.ts"

const execFileAsync = promisify(execFile)

export type CliDefaults = {
  model?: string
  effort?: Effort
}

const CLAUDE_MODELS = [
  { id: "opus", label: "Opus", efforts: [...EFFORTS] },
  { id: "sonnet", label: "Sonnet", efforts: [...EFFORTS] },
  { id: "haiku", label: "Haiku", efforts: [...EFFORTS] },
] as const

/** Read CLI settings; never write (DES-023). */
export function readCliDefaults(cli: CliKind): CliDefaults {
  if (cli === "claude") return readClaudeDefaults()
  return readCursorDefaults()
}

/** Build the model catalog for the Model Selector (DES-023). */
export async function listCliModels(cli: CliKind): Promise<CliModelCatalog> {
  const defaults = readCliDefaults(cli)
  const defaultLabel = formatDefaultLabel(defaults.model)

  if (cli === "claude") {
    return {
      cli,
      defaultLabel,
      defaults,
      models: CLAUDE_MODELS.map((m) => ({ ...m, efforts: [...m.efforts] })),
    }
  }

  try {
    const listed = await listCursorModelsFromCli()
    return {
      cli,
      defaultLabel,
      defaults,
      models: parseCursorModelList(listed),
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "list models failed"
    return {
      cli,
      defaultLabel,
      defaults,
      models: [],
      error: message,
    }
  }
}

function formatDefaultLabel(model: string | undefined): string {
  if (!model) return "Default"
  return `Default (${model})`
}

function readClaudeDefaults(): CliDefaults {
  try {
    const raw = readFileSync(
      join(homedir(), ".claude", "settings.json"),
      "utf8"
    )
    const json = JSON.parse(raw) as {
      model?: unknown
      effortLevel?: unknown
    }
    const out: CliDefaults = {}
    if (typeof json.model === "string" && json.model.trim()) {
      out.model = json.model.trim()
    }
    if (typeof json.effortLevel === "string") {
      const e = json.effortLevel.trim()
      if (isEffortValue(e)) out.effort = e
    }
    return out
  } catch {
    return {}
  }
}

function readCursorDefaults(): CliDefaults {
  try {
    const raw = readFileSync(
      join(homedir(), ".cursor", "cli-config.json"),
      "utf8"
    )
    const json = JSON.parse(raw) as {
      model?: { modelId?: unknown; displayModelId?: unknown }
    }
    const modelId =
      typeof json.model?.modelId === "string" ? json.model.modelId.trim() : ""
    const display =
      typeof json.model?.displayModelId === "string"
        ? json.model.displayModelId.trim()
        : ""
    if (modelId === "default" || display === "auto") {
      return { model: "auto" }
    }
    if (display) return { model: display }
    if (modelId) return { model: modelId }
    return {}
  } catch {
    return {}
  }
}

async function listCursorModelsFromCli(): Promise<ListedCursorModel[]> {
  const { stdout } = await execFileAsync("agent", ["--list-models"], {
    timeout: 15_000,
    encoding: "utf8",
  })
  return parseCursorListOutput(stdout)
}

/** Exported for fixture tests. */
export function parseCursorListOutput(stdout: string): ListedCursorModel[] {
  const out: ListedCursorModel[] = []
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.toLowerCase().startsWith("available")) continue
    const dash = trimmed.indexOf(" - ")
    if (dash <= 0) continue
    const id = trimmed.slice(0, dash).trim()
    const label = trimmed.slice(dash + 3).trim()
    if (id) out.push({ id, label: label || id })
  }
  return out
}

function isEffortValue(value: string): value is Effort {
  return (EFFORTS as readonly string[]).includes(value)
}
