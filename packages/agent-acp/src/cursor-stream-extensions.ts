import type { AgentEvent, TodoEntry } from "@workspace/core"
import type { RpcPeer } from "@workspace/protocol"
import {
  completedTaskResult,
  CURSOR_TASK_METHOD,
  parseTaskParams,
  rejectedTaskResult,
} from "./task.ts"
import {
  acceptedUpdateTodosResult,
  CURSOR_UPDATE_TODOS_METHOD,
  mergeTodos,
  parseUpdateTodosParams,
  rejectedUpdateTodosResult,
} from "./update-todos.ts"

export type CursorStreamExtensions = {
  /** Current merged todo list (session-scoped). */
  getTodos: () => readonly TodoEntry[]
  setTodos: (todos: TodoEntry[]) => void
  /** Push an AgentEvent into the active prompt stream when set. */
  emit: (event: AgentEvent) => void
}

/**
 * Handle Cursor `cursor/update_todos` and `cursor/task` as request and
 * notification (CLI may send either; DES-041 / BL-149).
 */
export function attachCursorStreamExtensions(
  peer: RpcPeer,
  ext: CursorStreamExtensions
): () => void {
  const onUpdateTodos = (params: unknown): unknown => {
    const parsed = parseUpdateTodosParams(params)
    if (!parsed) return rejectedUpdateTodosResult("invalid params")
    const next = mergeTodos(ext.getTodos(), parsed.todos, parsed.merge)
    ext.setTodos(next)
    ext.emit({ kind: "todos", entries: next })
    return acceptedUpdateTodosResult(next)
  }

  const onTask = (params: unknown): unknown => {
    const parsed = parseTaskParams(params)
    if (!parsed) return rejectedTaskResult("invalid params")
    const event: AgentEvent = {
      kind: "subagent",
      id: parsed.toolCallId,
      description: parsed.description,
      subagentType: parsed.subagentType,
      ...(parsed.durationMs !== undefined
        ? { durationMs: parsed.durationMs }
        : {}),
    }
    ext.emit(event)
    return completedTaskResult({
      ...(parsed.agentId !== undefined ? { agentId: parsed.agentId } : {}),
      ...(parsed.durationMs !== undefined
        ? { durationMs: parsed.durationMs }
        : {}),
    })
  }

  const unsubs = [
    peer.onRequest(CURSOR_UPDATE_TODOS_METHOD, (params) =>
      onUpdateTodos(params)
    ),
    peer.onNotification(CURSOR_UPDATE_TODOS_METHOD, (params) => {
      onUpdateTodos(params)
    }),
    peer.onRequest(CURSOR_TASK_METHOD, (params) => onTask(params)),
    peer.onNotification(CURSOR_TASK_METHOD, (params) => {
      onTask(params)
    }),
  ]

  return () => {
    for (const u of unsubs) u()
  }
}

export { CURSOR_TASK_METHOD, CURSOR_UPDATE_TODOS_METHOD }
