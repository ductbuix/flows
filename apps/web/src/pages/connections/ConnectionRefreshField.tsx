import { refreshRuleSchema, type RefreshRule } from "@workspace/shared"
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
import { PageSection } from "@/components/page"

const REFRESH: RefreshRule[] = ["15m", "1h", "1d", "never"]

type Props = {
  value: RefreshRule
  disabled?: boolean
  onChange: (refresh: RefreshRule) => void
}

export function ConnectionRefreshField({ value, disabled, onChange }: Props) {
  return (
    <PageSection title="Refresh rule">
      <Field className="max-w-xs">
        <FieldLabel>Refresh</FieldLabel>
        <Select
          value={value}
          disabled={disabled}
          onValueChange={(next) => {
            const parsed = refreshRuleSchema.safeParse(next)
            if (parsed.success) onChange(parsed.data)
          }}
        >
          <SelectTrigger data-testid="connection-refresh">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REFRESH.map((rule) => (
              <SelectItem key={rule} value={rule}>
                {rule}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldDescription>
          How often Flows considers pulled data stale.
        </FieldDescription>
      </Field>
    </PageSection>
  )
}
