export type AgentLaunchPaths = {
  workflowRoot: string
  attemptRoot: string
}

/** Shell-safe single-quoted string. */
export function shellSingleQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`
}

/** Prompt that points the CLI at the instructions file (DES-005). */
export function agentPrompt(instructionsAbsPath: string): string {
  return (
    `Read the file at ${instructionsAbsPath} and follow those instructions. ` +
    `Your working directory is this attempt. Write outputs under out/. ` +
    `Memories are under input/memory/. Upstream outputs are in the UPSTREAM_* env paths.`
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

/** Prompt for a Judge node: answer yes or no about this attempt's input (DES-032). */
export function judgeAnswerPrompt(ruleAbsPath: string): string {
  return (
    `Read the rule at ${ruleAbsPath}. Judge the input in input/text.md ` +
    `(and any files under input/files/) against that rule. Your first ` +
    `word must be yes or no. Add a short reason after it if you like.`
  )
}
