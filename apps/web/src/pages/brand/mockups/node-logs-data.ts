import type { LogEntry } from "@/pages/workflows/canvas/node-logs"

/** Newest first, as the log dialog lists them. */
export const ENTRIES: LogEntry[] = [
  {
    at: "2026-11-25T09:14:09Z",
    kind: "message",
    title: "Agent reply",
    text: "The build passes. Release notes are ready to publish.",
  },
  {
    at: "2026-11-25T09:14:06Z",
    kind: "command",
    title: "Run tests",
    command: "pnpm test",
    status: "done",
    text: "42 passed in 3.1s",
  },
  {
    at: "2026-11-25T09:14:02Z",
    kind: "tool_call",
    title: "Read package.json",
    status: "completed",
    text: '{ "name": "release-check" }',
  },
]

export const FAILURE = {
  error: "Error: Build failed with exit code 2",
  frames: [
    "at runBuild (scripts/build.ts:14:9)",
    "at main (scripts/build.ts:31:3)",
  ],
}

export const STDOUT = "> build\n> tsc --noEmit\n\nsrc/release.ts(12,7): error"
