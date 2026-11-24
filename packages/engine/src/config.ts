import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { parse as parseYaml } from "yaml"
import {
  appConfigSchema,
  type AppConfig,
  type WorkflowLimits,
} from "@workspace/contracts"

/** Load ~/.flowapp/config.yaml (or FLOWAPP_HOME). Missing file → {}. */
export function loadAppConfig(home: string): AppConfig {
  const path = join(home, "config.yaml")
  if (!existsSync(path)) return {}
  const raw = parseYaml(readFileSync(path, "utf8"))
  return appConfigSchema.parse(raw ?? {})
}

/**
 * Effective limit at global + workflow levels: the tighter (min) wins.
 * Undefined at both levels means no cap.
 */
export function effectiveLimit(
  globalLimits: WorkflowLimits | undefined,
  workflowLimits: WorkflowLimits | undefined,
  key: keyof WorkflowLimits
): number | undefined {
  const values = [globalLimits?.[key], workflowLimits?.[key]].filter(
    (v): v is number => typeof v === "number"
  )
  if (values.length === 0) return undefined
  return Math.min(...values)
}
