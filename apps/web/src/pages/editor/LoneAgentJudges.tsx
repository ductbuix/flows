import {
  loneAgentJudge,
  needTaskId,
  type AgentJudge,
  type Need,
  type Task,
} from "@workspace/shared"
import { Separator } from "@workspace/ui/components/separator"
import { LoneAgentJudgeFields } from "./LoneAgentJudgeFields"

type Props = {
  task: Task
  onChangeTask: (taskId: string, patch: Partial<Task>) => void
}

/** Drawer Model/Effort for lone agent when / until / need when (DES-023). */
export function LoneAgentJudges({ task, onChangeTask }: Props) {
  const whenJudge = loneAgentJudge(task.when)
  const untilJudge = loneAgentJudge(task.repeat?.until)
  const needJudges = (task.needs ?? []).flatMap((need, index) => {
    if (typeof need === "string" || !need.when) return []
    const judge = loneAgentJudge(need.when)
    if (!judge) return []
    return [{ index, need, judge, taskId: needTaskId(need) }]
  })

  if (!whenJudge && !untilJudge && needJudges.length === 0) return null

  function setWhenJudge(judge: AgentJudge) {
    onChangeTask(task.id, { when: { agent: judge } })
  }

  function setUntilJudge(judge: AgentJudge) {
    if (!task.repeat) return
    onChangeTask(task.id, {
      repeat: { ...task.repeat, until: { agent: judge } },
    })
  }

  function setNeedJudge(index: number, need: Need, judge: AgentJudge) {
    if (typeof need === "string") return
    const needs = [...(task.needs ?? [])]
    needs[index] = { ...need, when: { agent: judge } }
    onChangeTask(task.id, { needs })
  }

  return (
    <>
      <Separator />
      {whenJudge ? (
        <LoneAgentJudgeFields
          label="When judge"
          judge={whenJudge}
          idPrefix="when-"
          onChange={setWhenJudge}
        />
      ) : null}
      {untilJudge ? (
        <LoneAgentJudgeFields
          label="Until judge"
          judge={untilJudge}
          idPrefix="until-"
          onChange={setUntilJudge}
        />
      ) : null}
      {needJudges.map(({ index, need, judge, taskId }) => (
        <LoneAgentJudgeFields
          key={`need-${taskId}-${index}`}
          label={`Need ${taskId} when`}
          judge={judge}
          idPrefix={`need-${index}-`}
          onChange={(next) => setNeedJudge(index, need, next)}
        />
      ))}
    </>
  )
}
