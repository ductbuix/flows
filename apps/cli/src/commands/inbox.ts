import { openSession } from "../session.ts"

/** List open inbox items; always exits 0 when the call succeeds. */
export async function runInbox(home: string): Promise<number> {
  const session = await openSession(home)
  try {
    const listed = await session.client.call("inbox/list", {})
    for (const item of listed.items) {
      const line =
        item.kind === "permission"
          ? `${item.id}\t${item.kind}\t${item.status}\t${item.tool}\t${item.question}`
          : `${item.id}\t${item.kind}\t${item.status}\t${item.question}`
      process.stdout.write(`${line}\n`)
    }
    return 0
  } finally {
    session.close()
  }
}
