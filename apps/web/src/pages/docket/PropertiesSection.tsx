import { useState } from "react"
import type { BoardColumn } from "@workspace/contracts"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { formatDate } from "./format-date"
import { InlineText } from "./InlineText"
import { Adder, RemoveButton, Row, Section } from "./SectionParts"

export type PropertyPatch = {
  status?: string
  start?: string | null
  due?: string | null
  fields?: Record<string, unknown>
}

type Props = {
  status: string
  start?: string
  due?: string
  fields: Record<string, unknown>
  columns: BoardColumn[]
  onChange: (patch: PropertyPatch) => void
}

function fieldText(value: unknown): string {
  if (value == null) return ""
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function NewProperty({
  fields,
  done,
  onChange,
}: {
  fields: Record<string, unknown>
  done: () => void
  onChange: (patch: PropertyPatch) => void
}) {
  const [key, setKey] = useState("")
  const [value, setValue] = useState("")
  function add() {
    if (!key.trim()) return
    onChange({ fields: { ...fields, [key.trim()]: value } })
    done()
  }
  const onEnter = (e: React.KeyboardEvent) => e.key === "Enter" && add()
  return (
    <>
      <Input
        autoFocus
        value={key}
        onChange={(e) => setKey(e.target.value)}
        onKeyDown={onEnter}
        placeholder="Name"
        aria-label="New property name"
        data-testid="docket-prop-name"
      />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onEnter}
        placeholder="Value"
        aria-label="New property value"
        data-testid="docket-prop-value"
      />
      <Button
        variant="outline"
        disabled={!key.trim()}
        data-testid="docket-prop-add"
        onClick={add}
      >
        Add
      </Button>
    </>
  )
}

export function PropertiesSection({
  status,
  start,
  due,
  fields,
  columns,
  onChange,
}: Props) {
  return (
    <Section title="Properties">
      <Row label="Status">
        <Select
          value={status}
          items={columns.map((c) => ({ value: c.id, label: c.label }))}
          onValueChange={(v) => v && onChange({ status: v })}
        >
          <SelectTrigger
            aria-label="Status"
            data-testid="docket-prop-status"
            className="-mx-2 border-transparent bg-transparent px-2 hover:bg-muted"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {columns.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Row>
      <Row label="Start">
        <InlineText
          type="date"
          label="start date"
          placeholder="Set date"
          value={start ?? ""}
          format={formatDate}
          onSave={(v) => onChange({ start: v || null })}
        />
      </Row>
      <Row label="Due">
        <InlineText
          type="date"
          label="due date"
          placeholder="Set date"
          value={due ?? ""}
          format={formatDate}
          onSave={(v) => onChange({ due: v || null })}
        />
      </Row>
      {Object.entries(fields).map(([k, v]) => (
        <Row
          key={k}
          label={k}
          action={
            <RemoveButton
              label={`Remove property ${k}`}
              onClick={() => {
                const { [k]: _gone, ...rest } = fields
                void _gone
                onChange({ fields: rest })
              }}
            />
          }
        >
          <InlineText
            label={k}
            value={fieldText(v)}
            onSave={(next) => onChange({ fields: { ...fields, [k]: next } })}
          />
        </Row>
      ))}
      <Adder label="Add property">
        {(done) => (
          <NewProperty fields={fields} onChange={onChange} done={done} />
        )}
      </Adder>
    </Section>
  )
}
