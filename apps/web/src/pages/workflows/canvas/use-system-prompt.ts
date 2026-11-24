import { useCallback, useState } from "react"
import { useFlowsClient } from "@workspace/sdk-react"

/** Load / save `nodes/<id>/system.md` for LLM settings. */
export function useSystemPrompt(workflowId: string) {
  const client = useFlowsClient()
  const [text, setText] = useState("")
  const [hash, setHash] = useState<string | undefined>()

  const load = useCallback(
    (nodeId: string) => {
      const path = `workflows/${workflowId}/nodes/${nodeId}/system.md`
      void client
        .call("file/read_text", { path })
        .then((r) => {
          setText(r.text)
          setHash(r.hash)
        })
        .catch(() => {
          setText("")
          setHash(undefined)
        })
    },
    [client, workflowId]
  )

  const clear = useCallback(() => {
    setText("")
    setHash(undefined)
  }, [])

  const save = useCallback(
    (nodeId: string, next: string) => {
      setText(next)
      const path = `workflows/${workflowId}/nodes/${nodeId}/system.md`
      void client
        .call("file/write_text", {
          path,
          text: next,
          ...(hash ? { baseHash: hash } : {}),
        })
        .then((r) => setHash(r.hash))
        .catch(() => {})
    },
    [client, workflowId, hash]
  )

  return { text, load, clear, save }
}
