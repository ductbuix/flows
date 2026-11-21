import { Label } from "@workspace/ui/components/label"
import { Switch } from "@workspace/ui/components/switch"
import { useAdvanced } from "@/hooks/use-advanced"

/** Page-header Advanced Switch shared across screens (DES-024). */
export function AdvancedSwitch() {
  const { advanced, setAdvanced } = useAdvanced()
  return (
    <div className="flex items-center gap-2" data-testid="advanced-switch">
      <Switch
        id="flows-advanced"
        checked={advanced}
        onCheckedChange={setAdvanced}
        data-testid="advanced-switch-control"
      />
      <Label htmlFor="flows-advanced" className="text-sm">
        Advanced
      </Label>
    </div>
  )
}
