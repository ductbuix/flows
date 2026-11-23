import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { useColumns } from "./columns-store"
import { formatDate, type Card } from "./docket-data"
import { InlineText } from "./InlineText"
import { Adder, RemoveButton, Row, Section } from "./SectionParts"

type Props = { card: Card; onChange: (card: Card) => void }

function NewProperty({ card, done, onChange }: Props & { done: () => void }) {
  const [key, setKey] = useState("")
  const [value, setValue] = useState("")
  function add() {
    if (!key.trim()) return
    onChange({ ...card, fields: { ...card.fields, [key.trim()]: value } })
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
      />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onEnter}
        placeholder="Value"
        aria-label="New property value"
      />
      <Button variant="outline" disabled={!key.trim()} onClick={add}>
        Add
      </Button>
    </>
  )
}

export function PropertiesSection({ card, onChange }: Props) {
  const columns = useColumns()
  return (
    <Section title="Properties">
      <Row label="Status">
        <Select
          value={card.status}
          items={columns.map((c) => ({ value: c.id, label: c.label }))}
          onValueChange={(v) => v && onChange({ ...card, status: v })}
        >
          <SelectTrigger
            aria-label="Status"
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
          value={card.start ?? ""}
          format={formatDate}
          onSave={(v) => onChange({ ...card, start: v || undefined })}
        />
      </Row>
      <Row label="Due">
        <InlineText
          type="date"
          label="due date"
          placeholder="Set date"
          value={card.due ?? ""}
          format={formatDate}
          onSave={(v) => onChange({ ...card, due: v || undefined })}
        />
      </Row>
      {Object.entries(card.fields).map(([k, v]) => (
        <Row
          key={k}
          label={k}
          action={
            <RemoveButton
              label={`Remove property ${k}`}
              onClick={() => {
                const { [k]: gone, ...rest } = card.fields
                void gone
                onChange({ ...card, fields: rest })
              }}
            />
          }
        >
          <InlineText
            label={k}
            value={v}
            onSave={(next) =>
              onChange({ ...card, fields: { ...card.fields, [k]: next } })
            }
          />
        </Row>
      ))}
      <Adder label="Add property">
        {(done) => <NewProperty card={card} onChange={onChange} done={done} />}
      </Adder>
    </Section>
  )
}
