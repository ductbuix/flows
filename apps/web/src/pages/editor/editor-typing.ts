/** True when Delete/Backspace or undo should not run (DES-022). */
export function isEditorTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  if (target.closest(".cm-editor")) return true
  const el = target instanceof HTMLElement ? target : target.parentElement
  if (!el) return false
  if (el.isContentEditable) return true
  const tag = el.tagName
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT"
}
