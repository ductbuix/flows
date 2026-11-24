import { useState } from "react"
import { Field, FieldDescription } from "@workspace/ui/components/field"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import { PageSection } from "@/components/page"
import {
  isTextSize,
  readTextSize,
  saveTextSize,
  type TextSize,
} from "@/lib/text-size"

export function SettingsTextSizeSection() {
  const [size, setSize] = useState<TextSize>(() => readTextSize())
  return (
    <PageSection title="Text size">
      <Field>
        <ToggleGroup
          value={[size]}
          onValueChange={(v) => {
            const next = v[0]
            if (isTextSize(next)) {
              saveTextSize(next)
              setSize(next)
            }
          }}
          variant="outline"
          data-testid="text-size-toggle"
        >
          <ToggleGroupItem value="small" data-testid="text-size-small">
            Small
          </ToggleGroupItem>
          <ToggleGroupItem value="default" data-testid="text-size-default">
            Default
          </ToggleGroupItem>
          <ToggleGroupItem value="large" data-testid="text-size-large">
            Large
          </ToggleGroupItem>
        </ToggleGroup>
        <FieldDescription>
          Scales all text in the app. Saved on this device.
        </FieldDescription>
      </Field>
    </PageSection>
  )
}
