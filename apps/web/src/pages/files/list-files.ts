import type { FlowsClient } from "@workspace/sdk"

/** Page through file/list until exhausted; returns file paths only. */
export async function listAllFilePaths(
  client: FlowsClient,
  prefix = ""
): Promise<string[]> {
  const paths: string[] = []
  let cursor: string | undefined
  for (;;) {
    const page = await client.call("file/list", {
      path: prefix || undefined,
      cursor,
      limit: 500,
    })
    for (const item of page.items) {
      if (item.kind === "file") paths.push(item.path)
    }
    if (!page.next) break
    cursor = page.next
  }
  return paths
}
