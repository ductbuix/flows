import { homedir } from "node:os"
import { join } from "node:path"

/** FLOWAPP_HOME when set, otherwise ~/.flowapp (DES-039). */
export function resolveHome(env: NodeJS.ProcessEnv = process.env): string {
  const fromEnv = env.FLOWAPP_HOME?.trim()
  if (fromEnv) return fromEnv
  return join(homedir(), ".flowapp")
}
