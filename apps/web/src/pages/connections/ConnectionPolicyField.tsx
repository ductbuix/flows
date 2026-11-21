import { publishPolicySchema, type PublishPolicy } from "@workspace/shared"
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
import { Section } from "@/components/Section"

const POLICIES: PublishPolicy[] = ["read-only", "approve-each-publish"]

const LABELS: Record<PublishPolicy, string> = {
  "read-only": "Read only",
  "approve-each-publish": "Approve each publish",
}

const DESCRIPTIONS: Record<PublishPolicy, string> = {
  "read-only":
    "Nobody publishes; the source is only context. Default for new connections.",
  "approve-each-publish":
    "A person reviews each publish with a warning. Use when a mistake affects others or is hard to undo.",
}

type Props = {
  value: PublishPolicy
  disabled?: boolean
  onChange: (policy: PublishPolicy) => void
}

/** Editable publish policy Select with FieldDescription per option (BL-051). */
export function ConnectionPolicyField({ value, disabled, onChange }: Props) {
  return (
    <Section title="Publish policy">
      <Field className="max-w-md">
        <FieldLabel>Policy</FieldLabel>
        <Select
          value={value}
          disabled={disabled}
          onValueChange={(next) => {
            const parsed = publishPolicySchema.safeParse(next)
            if (parsed.success) onChange(parsed.data)
          }}
        >
          <SelectTrigger data-testid="connection-policy-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {POLICIES.map((policy) => (
              <SelectItem key={policy} value={policy}>
                {LABELS[policy]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {POLICIES.map((policy) => (
          <FieldDescription
            key={policy}
            data-testid={`connection-policy-help-${policy}`}
            className={policy === value ? undefined : "hidden"}
          >
            {DESCRIPTIONS[policy]}
          </FieldDescription>
        ))}
      </Field>
    </Section>
  )
}
