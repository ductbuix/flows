export type AgentLaunchPaths = {
  workflowRoot: string
  attemptRoot: string
}

/** Shell-safe single-quoted string. */
export function shellSingleQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`
}

/** Prompt that points the CLI at the instructions file (DES-005). */
export function agentPrompt(
  instructionsAbsPath: string,
  canSpawn: boolean
): string {
  const spawn = canSpawn
    ? " To spawn tasks, write one YAML task spec per file under out/spawn/<stem>.yaml; for agent tasks put prompt.md (and judge files) under out/spawn/<stem>/."
    : ""
  return (
    `Read the file at ${instructionsAbsPath} and follow those instructions. ` +
    `Your working directory is this attempt. Write outputs under out/. ` +
    `Memories are under input/memory/. Upstream outputs are in the UPSTREAM_* env paths.` +
    spawn
  )
}

/** Prompt: inspect the attempt and exit 0/non-zero (DES-004). */
export function judgePrompt(instructionsAbsPath: string): string {
  return (
    `Read the file at ${instructionsAbsPath} and follow those instructions ` +
    `to judge this attempt. Your working directory is this attempt. ` +
    `Inspect out/ and any paths mentioned. Exit with code 0 if the ` +
    `condition passes, or a non-zero code if it fails.`
  )
}
