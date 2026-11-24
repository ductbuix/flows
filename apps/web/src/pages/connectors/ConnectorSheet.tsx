import { Sheet, SheetContent } from "@workspace/ui/components/sheet"
import { ConnectorSheetBody } from "./ConnectorSheetBody"

export function ConnectorSheet({
  openId,
  onClose,
  onRemoved,
  onConflict,
  onError,
}: {
  openId: string | null
  onClose: () => void
  onRemoved: () => void
  onConflict: () => void
  onError: (message: string) => void
}) {
  return (
    <Sheet open={!!openId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        className="data-[side=right]:sm:max-w-lg"
        data-testid="connector-sheet"
      >
        {openId ? (
          <ConnectorSheetBody
            id={openId}
            onRemoved={onRemoved}
            onConflict={onConflict}
            onError={onError}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
