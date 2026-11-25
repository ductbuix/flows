import { Field, FieldDescription } from "@workspace/ui/components/field"
import { Kbd } from "@workspace/ui/components/kbd"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import { PageSection } from "@/components/page"
import { useTheme } from "@/components/theme-provider"

export function SettingsThemeSection() {
  const { theme, setTheme } = useTheme()
  return (
    <PageSection title="Theme">
      <Field>
        <ToggleGroup
          value={[theme]}
          onValueChange={(v) => {
            const next = v[0]
            if (next === "light" || next === "dark" || next === "system")
              setTheme(next)
          }}
          variant="outline"
          data-testid="theme-toggle"
        >
          <ToggleGroupItem value="light">Light</ToggleGroupItem>
          <ToggleGroupItem value="dark">Dark</ToggleGroupItem>
          <ToggleGroupItem value="system">System</ToggleGroupItem>
        </ToggleGroup>
        <FieldDescription data-testid="theme-shortcut-hint">
          Default is light. Press <Kbd>d</Kbd> to toggle light and dark.
        </FieldDescription>
      </Field>
    </PageSection>
  )
}
