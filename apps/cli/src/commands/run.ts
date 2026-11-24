import { randomUUID } from "node:crypto"
import type { RunStatus } from "@workspace/contracts"
import type { FlowsClient } from "@workspace/sdk"
import { openSession } from "../session.ts"

export type RunCommandOptions = {
  home: string
  workflowId: string
  cardId?: string
}

/** Start a run, stream updates, exit 0 on succeeded else 1. */
export async function runWorkflow(opts: RunCommandOptions): Promise<number> {
  const session = await openSession(opts.home)
  try {
    const status = await waitForRun(session.client, opts)
    process.stdout.write(`${status}\n`)
    return status === "succeeded" ? 0 : 1
  } finally {
    session.close()
  }
}

async function waitForRun(
  client: FlowsClient,
  opts: RunCommandOptions
): Promise<RunStatus> {
  let resolveFinished!: (status: RunStatus) => void
  const finished = new Promise<RunStatus>((resolve) => {
    resolveFinished = resolve
  })

  const unsub = client.onNotification("run/update", (params) => {
    if (params.kind === "run_changed" && params.summary) {
      process.stderr.write(
        `run ${params.runId} ${params.summary.status} ` +
          `${params.summary.taskCounts.done}/${params.summary.taskCounts.total}\n`
      )
    }
    if (params.kind === "step_state") {
      process.stderr.write(`step ${params.step.nodeId} ${params.step.status}\n`)
    }
    if (params.kind === "run_finished") {
      resolveFinished(params.status)
    }
  })

  try {
    await client.call("subscribe", { topics: ["run"] })
    const { runId } = await client.call("run/start", {
      workflowId: opts.workflowId,
      requestKey: randomUUID(),
      ...(opts.cardId ? { cardId: opts.cardId } : {}),
    })
    await client.call("subscribe", {
      topics: [`run:${runId}`],
      since: 0,
    })
    return await finished
  } finally {
    unsub()
  }
}
