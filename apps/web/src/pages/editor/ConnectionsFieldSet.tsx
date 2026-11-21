import { useEffect, useState } from "react"
import type { Task, TaskUsesEntry } from "@workspace/shared"
import { connectionsListSchema } from "@workspace/shared"
import { Button } from "@workspace/ui/components/button"
import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@workspace/ui/components/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { api } from "@/lib/api"

type Props = {
  task: Task
  onChangeTask: (taskId: string, patch: Partial<Task>) => void
}

export function ConnectionsFieldSet({ task, onChangeTask }: Props) {
  const NONE = "__none__"
  const [connectionIds, setConnectionIds] = useState<string[]>([])
  const [pick, setPick] = useState<string>(NONE)
  const uses = task.uses ?? []

  useEffect(() => {
    let alive = true
    void (async () => {
      const res = await api.connections.$get()
      if (!alive || !res.ok) return
      const body = connectionsListSchema.parse(await res.json())
      setConnectionIds(body.connections.map((c) => c.id).sort())
    })()
    return () => {
      alive = false
    }
  }, [])

  const used = new Set(uses.map((u) => u.connection))
  const available = connectionIds.filter((id) => !used.has(id))

  function setUses(next: TaskUsesEntry[] | undefined) {
    onChangeTask(task.id, {
      uses: next && next.length > 0 ? next : undefined,
    })
  }

  function addConnection() {
    if (!pick || pick === NONE) return
    setUses([...uses, { connection: pick, access: "read" }])
    setPick(NONE)
  }

  function removeConnection(connection: string) {
    setUses(uses.filter((u) => u.connection !== connection))
  }

  function setAccess(connection: string, access: TaskUsesEntry["access"]) {
    setUses(
      uses.map((u) => (u.connection === connection ? { ...u, access } : u))
    )
  }

  return (
    <FieldSet data-testid="connections-fieldset">
      <FieldLegend variant="label">Connections</FieldLegend>
      {uses.length === 0 ? (
        <FieldDescription>No connections on this task yet.</FieldDescription>
      ) : (
        <ul className="flex flex-col gap-3">
          {uses.map((entry) => (
            <li
              key={entry.connection}
              className="flex flex-col gap-2"
              data-testid={`connection-use-${entry.connection}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm">{entry.connection}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  data-testid={`connection-remove-${entry.connection}`}
                  onClick={() => removeConnection(entry.connection)}
                >
                  Remove
                </Button>
              </div>
              <Field>
                <FieldLabel>Access</FieldLabel>
                <Select
                  value={entry.access}
                  onValueChange={(access) => {
                    if (access === "read" || access === "propose") {
                      setAccess(entry.connection, access)
                    }
                  }}
                >
                  <SelectTrigger
                    data-testid={`connection-access-${entry.connection}`}
                  >
                    <SelectValue>
                      {entry.access === "propose" ? "Propose changes" : "Read"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="read">Read</SelectItem>
                    <SelectItem value="propose">Propose changes</SelectItem>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Propose changes writes a local work copy for a later publish
                  task.
                </FieldDescription>
              </Field>
            </li>
          ))}
        </ul>
      )}
      <Field>
        <FieldLabel>Add connection</FieldLabel>
        <div className="flex gap-2">
          <Select value={pick} onValueChange={(v) => v && setPick(v)}>
            <SelectTrigger data-testid="connection-add-select">
              <SelectValue placeholder="Pick a connection" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE} disabled>
                {available.length === 0
                  ? "No connections left"
                  : "Pick a connection"}
              </SelectItem>
              {available.map((id) => (
                <SelectItem key={id} value={id}>
                  {id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="connection-add"
            disabled={pick === NONE}
            onClick={addConnection}
          >
            Add
          </Button>
        </div>
        <FieldDescription>
          New connections are added with Read access.
        </FieldDescription>
      </Field>
    </FieldSet>
  )
}
