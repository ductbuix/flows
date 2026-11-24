import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { SettingsThemeSection } from "./SettingsThemeSection"
import { SettingsTrustBody } from "./SettingsTrustSections"

type Props = {
  open: boolean
  onClose: () => void
}

/** Settings sheet from the sidebar footer (BL-210): theme, CLIs, trust, MCP. */
export function SettingsPanel({ open, onClose }: Props) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        className="data-[side=right]:sm:max-w-lg overflow-y-auto"
        data-testid="settings-panel"
      >
        <SheetHeader className="pr-12">
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>
            Theme, agent CLIs, always-trust and allowed MCP servers.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-4 pb-6">
          <SettingsThemeSection />
          {open ? <SettingsTrustBody /> : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
