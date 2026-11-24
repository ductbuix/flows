import type { LibItem } from "./library-types"

const v = (n: number, at: string, note: string, size: string) => ({
  n,
  at,
  note,
  size,
})

/** Items copied from disk: no remote, one version. */
export const LOCAL_ITEMS: LibItem[] = [
  {
    id: "img-flake",
    kind: "image",
    title: "flake.png",
    source: "local",
    tags: ["project:auth", "type:screenshot", "rally:US1234"],
    assets: [{ name: "flake.png", kind: "image", size: "96 KB" }],
    versions: [v(1, "2026-11-20 09:30", "Added from disk", "96 KB")],
    current: 1,
    usedBy: ["fix-flaky-login"],
  },
  {
    id: "html-brand",
    kind: "html",
    title: "Brand guidelines",
    source: "local",
    tags: ["project:docket", "type:design"],
    assets: [{ name: "brand.html", kind: "html", size: "88 KB" }],
    versions: [v(1, "2026-11-14 16:00", "Added from disk", "88 KB")],
    current: 1,
    usedBy: [],
  },
  {
    id: "other-tokens",
    kind: "other",
    title: "Design tokens",
    source: "local",
    tags: ["project:docket", "type:design", "lang:json"],
    assets: [{ name: "tokens.json", kind: "json", size: "12 KB" }],
    versions: [v(1, "2026-11-14 16:05", "Added from disk", "12 KB")],
    current: 1,
    usedBy: [],
  },
]
