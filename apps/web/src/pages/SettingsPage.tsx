import {
  Field,
  FieldDescription,
  FieldGroup,
} from "@workspace/ui/components/field"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import { Kbd } from "@workspace/ui/components/kbd"
import { Page, PageSection, PageTitle } from "@/components/page"
import { useTheme } from "@/components/theme-provider"

/**
 * Theme settings only. CLI status, always-trust and MCP allow need FCP
 * methods that do not exist yet (see BL-185 phase A notes).
 */
export function SettingsPage() {
  const { theme, setTheme } = useTheme()

  return (
    <Page crumbs={[{ label: "Settings" }]} data-testid="settings-page">
      <PageTitle title="Settings" description="Theme." />
      <FieldGroup className="max-w-xl gap-6">
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
      </FieldGroup>
    </Page>
  )
}
