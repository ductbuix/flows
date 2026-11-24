import { MoreHorizontal, SquareKanban, Trash2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { formatDate } from "./format-date"
import { InlineText } from "./InlineText"

type Props = {
  id: string
  title: string
  due?: string
  conflict: boolean
  saveError: string | null
  onSaveTitle: (title: string) => void
  onDelete: () => void
}

export function CardPanelHeader({
  id,
  title,
  due,
  conflict,
  saveError,
  onSaveTitle,
  onDelete,
}: Props) {
  return (
    <>
      <SheetHeader>
        <div className="flex items-center justify-between pr-8 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <SquareKanban className="size-4" />
            Card
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon" aria-label="Card actions" />
              }
            >
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                variant="destructive"
                data-testid="docket-delete"
                onClick={onDelete}
              >
                <Trash2 />
                Delete card
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <SheetTitle className="sr-only">{title}</SheetTitle>
        <InlineText
          label="title"
          placeholder="Untitled"
          className="font-heading text-xl font-medium"
          value={title}
          onSave={onSaveTitle}
        />
        <SheetDescription>
          {id}
          {due ? ` · Due ${formatDate(due)}` : null}
        </SheetDescription>
      </SheetHeader>
      {(conflict || saveError) && (
        <Alert
          variant="destructive"
          className="mx-4"
          data-testid="docket-conflict"
        >
          <AlertTitle>{conflict ? "Conflict" : "Could not save"}</AlertTitle>
          <AlertDescription>
            {conflict
              ? "This card changed on disk. Close and reopen to reload."
              : saveError}
          </AlertDescription>
        </Alert>
      )}
    </>
  )
}
