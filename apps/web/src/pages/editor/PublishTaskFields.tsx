import {
  isPublishTask,
  proposeConnectionsForPublish,
  type Task,
  type Workflow,
} from "@workspace/shared"
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@workspace/ui/components/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

type Props = {
  task: Task
  workflow: Workflow
  onChangeTask: (taskId: string, patch: Partial<Task>) => void
}

/** Connection Select for a publish task (DES-025 / BL-051). */
export function PublishTaskFields({ task, workflow, onChangeTask }: Props) {
  if (!isPublishTask(task)) return null
  const options = proposeConnectionsForPublish(workflow, task.id)
  const value = options.includes(task.connection)
    ? task.connection
    : (options[0] ?? task.connection)

  return (
    <Field>
      <FieldLabel>Connection</FieldLabel>
      <Select
        value={value}
        onValueChange={(connection) => {
          if (connection) onChangeTask(task.id, { connection } as Partial<Task>)
        }}
      >
        <SelectTrigger data-testid="field-publish-connection">
          <SelectValue placeholder="Pick a connection" />
        </SelectTrigger>
        <SelectContent>
          {options.length === 0 ? (
            <SelectItem value={task.connection} disabled>
              No propose connection yet
            </SelectItem>
          ) : (
            options.map((id) => (
              <SelectItem key={id} value={id}>
                {id}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      <FieldDescription>
        Only connections with a propose task before this one via needs.
      </FieldDescription>
    </Field>
  )
}
