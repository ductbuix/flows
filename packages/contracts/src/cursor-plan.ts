import { z } from "zod"

/** Todo status on a Cursor `cursor/create_plan` request. */
export const cursorPlanTodoStatusSchema = z.enum([
  "pending",
  "in_progress",
  "completed",
  "cancelled",
])

/** One todo on a Cursor plan (DES-041 / BL-148). */
export const cursorPlanTodoSchema = z.object({
  id: z.string().min(1),
  content: z.string().min(1),
  status: cursorPlanTodoStatusSchema,
})

/** Optional phase grouping for larger plans. */
export const cursorPlanPhaseSchema = z.object({
  name: z.string().min(1),
  todos: z.array(cursorPlanTodoSchema),
})

export type CursorPlanTodoStatus = z.infer<typeof cursorPlanTodoStatusSchema>
export type CursorPlanTodo = z.infer<typeof cursorPlanTodoSchema>
export type CursorPlanPhase = z.infer<typeof cursorPlanPhaseSchema>
