/**
 * App text size. Tailwind sizes are rem-based, so scaling the root font size
 * scales the whole app. Percentages keep the browser's own base size.
 */
export const TEXT_SIZES = ["small", "default", "large"] as const
export type TextSize = (typeof TEXT_SIZES)[number]

const STORAGE_KEY = "text-size"
const ROOT_PERCENT: Record<TextSize, string> = {
  small: "87.5%",
  default: "100%",
  large: "112.5%",
}

export function isTextSize(value: unknown): value is TextSize {
  return (
    typeof value === "string" &&
    (TEXT_SIZES as readonly string[]).includes(value)
  )
}

export function readTextSize(): TextSize {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isTextSize(stored) ? stored : "default"
  } catch {
    return "default"
  }
}

export function applyTextSize(size: TextSize): void {
  document.documentElement.style.fontSize = ROOT_PERCENT[size]
}

export function saveTextSize(size: TextSize): void {
  applyTextSize(size)
  try {
    localStorage.setItem(STORAGE_KEY, size)
  } catch {
    // Storage blocked: the size still applies for this session.
  }
}
