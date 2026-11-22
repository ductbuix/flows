import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@workspace/ui/components/command"
import {
  GROUP_LABEL,
  GROUP_ORDER,
  KIND_META,
  kindIcon,
  kindsInGroup,
} from "./node-kind-ui"

type Props = {
  title: string
  /** Limit the list to these kinds (a wire's port decides). */
  kinds?: readonly string[]
  onPick: (kind: string) => void
}

/** Search, then Inputs, Steps, Flow; shared by the toolbar and wire drops. */
export function AddNodeList({ title, kinds, onPick }: Props) {
  return (
    <Command data-testid="add-node-list" aria-label={title}>
      <CommandInput placeholder="Search nodes" aria-label="Search nodes" />
      <CommandList>
        <CommandEmpty>No node matches.</CommandEmpty>
        {GROUP_ORDER.map((group) => {
          const list = kindsInGroup(group, kinds)
          if (list.length === 0) return null
          return (
            <CommandGroup key={group} heading={GROUP_LABEL[group]}>
              {list.map((kind) => {
                const meta = KIND_META[kind]
                const Icon = kindIcon(kind)
                return (
                  <CommandItem
                    key={kind}
                    value={`${kind} ${meta?.hint ?? ""}`}
                    data-testid={`add-node-${kind}`}
                    onSelect={() => onPick(kind)}
                  >
                    {Icon ? <Icon /> : null}
                    <span>{meta?.label ?? kind}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {meta?.hint}
                    </span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          )
        })}
      </CommandList>
    </Command>
  )
}
