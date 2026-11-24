import type { ProviderIcon } from "@workspace/contracts"
import {
  BookOpen,
  File,
  FileCode,
  GitBranch,
  Globe,
  Hammer,
  Image,
  ListChecks,
  ScrollText,
} from "lucide-react"

const ICON: Record<ProviderIcon, typeof File> = {
  repo: GitBranch,
  confluence: BookOpen,
  rally: ListChecks,
  ci: Hammer,
  logs: ScrollText,
  web: Globe,
  image: Image,
  html: FileCode,
  other: File,
}

export const KIND_SINGULAR: Record<ProviderIcon, string> = {
  repo: "Repository",
  confluence: "Confluence page",
  rally: "Rally item",
  ci: "Build",
  logs: "Log query",
  web: "Web page",
  image: "Image",
  html: "HTML file",
  other: "File",
}

export function KindIcon({
  kind,
  className,
}: {
  kind: ProviderIcon
  className?: string
}) {
  const Icon = ICON[kind]
  return <Icon className={className} />
}
