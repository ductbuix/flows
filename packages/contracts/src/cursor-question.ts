import { z } from "zod"

/** One option on a Cursor `cursor/ask_question` prompt. */
export const cursorAskOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
})

/** One question in a Cursor `cursor/ask_question` request. */
export const cursorAskQuestionSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  options: z.array(cursorAskOptionSchema).min(1),
  allowMultiple: z.boolean().optional(),
})

/** Selected options for one question (multi-select uses several ids). */
export const cursorAskAnswerSchema = z.object({
  questionId: z.string().min(1),
  selectedOptionIds: z.array(z.string().min(1)).min(1),
})

export type CursorAskOption = z.infer<typeof cursorAskOptionSchema>
export type CursorAskQuestion = z.infer<typeof cursorAskQuestionSchema>
export type CursorAskAnswer = z.infer<typeof cursorAskAnswerSchema>
