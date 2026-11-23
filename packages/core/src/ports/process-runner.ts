/** Seatbelt / sandbox knobs applied by the Node adapter (DES-006, DES-041). */
export type ProcessSandboxProfile = {
  /** Workflow root; writes allowed under `writeRoot` ?? this path. */
  workflowRoot: string
  /** Allow writes under ~/.cursor (Cursor agent; BL-018). */
  allowCursorHome?: boolean
  /** Narrow the write root (e.g. one attempt for LLM). */
  writeRoot?: string
}

/** What to spawn; when `sandbox` is set the adapter wraps with sandbox-exec. */
export type ProcessSpawnSpec = {
  command: string
  args?: readonly string[]
  cwd?: string
  env?: Readonly<Record<string, string | undefined>>
  sandbox?: ProcessSandboxProfile
}

/**
 * A live child in its own process group (DES-041). Aborting `signal` ends
 * the group. `sandboxed` is whether sandbox-exec was applied.
 */
export type RunningProcess = {
  pid: number
  stdin: WritableStream<Uint8Array>
  stdout: ReadableStream<Uint8Array>
  stderr: ReadableStream<Uint8Array>
  exit: Promise<number>
  sandboxed: boolean
}

/** Spawn local processes; Node adapter uses child_process + sandbox-exec. */
export interface ProcessRunner {
  spawn(spec: ProcessSpawnSpec, signal: AbortSignal): RunningProcess
}
