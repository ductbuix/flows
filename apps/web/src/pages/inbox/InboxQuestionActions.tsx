import { useState } from "react"
import { Check, X } from "lucide-react"
import { Link } from "react-router"
import type { WireInboxItem } from "@workspace/contracts"
import { Button } from "@workspace/ui/components/button"

type QuestionItem = Extract<WireInboxItem, { kind: "question" }>

export function InboxQuestionActions({
  item,
  busy,
  onAnswer,
  onSkip,
  onDismiss,
}: {
  item: QuestionItem
  busy: boolean
  onAnswer: (
    answers: { questionId: string; selectedOptionIds: string[] }[]
  ) => void
  onSkip: () => void
  onDismiss: () => void
}) {
  const [selected, setSelected] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {}
    for (const q of item.questions) init[q.id] = []
    return init
  })

  function toggle(questionId: string, optionId: string, multi: boolean) {
    setSelected((prev) => {
      const cur = prev[questionId] ?? []
      if (multi) {
        const next = cur.includes(optionId)
          ? cur.filter((id) => id !== optionId)
          : [...cur, optionId]
        return { ...prev, [questionId]: next }
      }
      return { ...prev, [questionId]: cur[0] === optionId ? [] : [optionId] }
    })
  }

  const complete = item.questions.every(
    (q) => (selected[q.id] ?? []).length > 0
  )

  return (
    <div className="flex flex-col gap-3">
      {item.questions.map((q) => (
        <div key={q.id} className="flex flex-col gap-2">
          <span className="text-sm font-medium">{q.prompt}</span>
          <div className="flex flex-wrap gap-2">
            {q.options.map((opt) => {
              const on = (selected[q.id] ?? []).includes(opt.id)
              return (
                <Button
                  key={opt.id}
                  variant={on ? "default" : "outline"}
                  disabled={busy}
                  onClick={() => toggle(q.id, opt.id, q.allowMultiple === true)}
                  data-testid={`inbox-qopt-${item.id}-${q.id}-${opt.id}`}
                >
                  {opt.label}
                </Button>
              )
            })}
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={busy || !complete}
          onClick={() =>
            onAnswer(
              item.questions.map((q) => ({
                questionId: q.id,
                selectedOptionIds: selected[q.id] ?? [],
              }))
            )
          }
          data-testid={`inbox-answer-${item.id}`}
        >
          <Check />
          Answer
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={onSkip}
          data-testid={`inbox-skip-${item.id}`}
        >
          <X />
          Skip
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={onDismiss}
          data-testid={`inbox-dismiss-${item.id}`}
        >
          Dismiss
        </Button>
        {item.workflowId ? (
          <Button
            variant="ghost"
            className="ml-auto"
            nativeButton={false}
            render={
              <Link to={`/workflows/${item.workflowId}?run=${item.runId}`} />
            }
          >
            Open run
          </Button>
        ) : null}
      </div>
    </div>
  )
}
