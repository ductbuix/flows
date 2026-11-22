import { ScaleIcon } from "lucide-react"
import {
  CHECK_OPERATORS,
  type CheckOperator,
  type JudgeCheck,
} from "@workspace/shared"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Textarea } from "@workspace/ui/components/textarea"
import { CliModelRow } from "./CliModelRow"
import { defineNodeView, type NodeBodyProps, type NodeOf } from "./define"

const NO_VALUE: readonly CheckOperator[] = ["set", "unset"]

/** The check as YAML keeps it: `value` only for operators that take one. */
function nextCheck(check: JudgeCheck, change: Partial<JudgeCheck>): JudgeCheck {
  const next = { ...check, ...change }
  if (NO_VALUE.includes(next.operator)) delete next.value
  else if (next.value === undefined) next.value = ""
  return next
}

function CheckFields({
  check,
  onChange,
  onEditEnd,
}: {
  check: JudgeCheck
  onChange: (check: JudgeCheck) => void
  onEditEnd: () => void
}) {
  return (
    <div className="nodrag flex flex-col gap-2" data-testid="judge-check">
      <Input
        data-testid="judge-check-field"
        aria-label="Answer name"
        placeholder="Answer name"
        value={check.field}
        onChange={(e) => onChange(nextCheck(check, { field: e.target.value }))}
        onBlur={onEditEnd}
      />
      <div className="flex gap-2">
        <Select
          value={check.operator}
          onValueChange={(v) => {
            if (v) {
              onChange(nextCheck(check, { operator: v as CheckOperator }))
              onEditEnd()
            }
          }}
        >
          <SelectTrigger data-testid="judge-check-operator" aria-label="Operator">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHECK_OPERATORS.map((op) => (
              <SelectItem key={op} value={op}>
                {op}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {NO_VALUE.includes(check.operator) ? null : (
          <Input
            data-testid="judge-check-value"
            aria-label="Value"
            placeholder="Value"
            value={String(check.value ?? "")}
            onChange={(e) => onChange(nextCheck(check, { value: e.target.value }))}
            onBlur={onEditEnd}
          />
        )}
      </div>
    </div>
  )
}

function JudgeBody({
  node,
  text,
  onSetting,
  onText,
  onEditEnd,
}: NodeBodyProps<NodeOf<"judge">>) {
  const mode = node.mode ?? "rule"
  return (
    <div className="nodrag flex flex-col gap-2">
      <Select
        value={mode}
        onValueChange={(v) => {
          if (v !== "rule" && v !== "check") return
          onSetting("mode", v === "rule" ? undefined : v)
          if (v === "check") {
            onSetting("cli", undefined)
            onSetting("model", undefined)
            onSetting("effort", undefined)
            onSetting("check", node.check ?? { field: "", operator: "=", value: "" })
          } else {
            onSetting("check", undefined)
            onSetting("cli", node.cli ?? "claude")
          }
          onEditEnd()
        }}
      >
        <SelectTrigger data-testid="judge-mode" aria-label="Mode">
          <SelectValue>
            {mode === "check" ? "Check (no model)" : "Rule (model)"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="rule">Rule (model)</SelectItem>
          <SelectItem value="check">Check (no model)</SelectItem>
        </SelectContent>
      </Select>
      {mode === "check" ? (
        <CheckFields
          check={node.check ?? { field: "", operator: "=", value: "" }}
          onChange={(c) => onSetting("check", c)}
          onEditEnd={onEditEnd}
        />
      ) : (
        <>
          <CliModelRow
            cli={node.cli ?? "claude"}
            model={node.model}
            effort={node.effort}
            onSetting={onSetting}
          />
          <Textarea
            data-testid="judge-rule"
            aria-label="Rule"
            className="nowheel max-h-40 min-h-16"
            placeholder="What decides yes or no?"
            value={text}
            onChange={(e) => onText(e.target.value)}
            onBlur={onEditEnd}
          />
        </>
      )}
    </div>
  )
}

export const judgeView = defineNodeView({
  kind: "judge",
  icon: ScaleIcon,
  Body: JudgeBody,
})
