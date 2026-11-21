/**
 * Detects banned Tailwind class tokens in apps/web (DES-024).
 * Arbitrary values are OK only under data-/aria-/has-/group- variants.
 */

const VARIANT_OK = /^(?:[\w-]+:)*(?:data|aria|has|group)-/
const ARBITRARY =
  /(?:^|[\s"'`])((?:[\w-]+:)*[\w/-]+-\[[^\]]+\])/g
const PALETTE =
  /(?:^|[\s"'`])((?:[\w-]+:)*(?:text|bg|border|ring|outline|fill|stroke|from|to|via)-(?:amber|red|blue|green|yellow|orange|purple|pink|indigo|violet|cyan|teal|lime|emerald|sky|fuchsia|rose|slate|gray|zinc|neutral|stone|white|black)(?:-\d+)?(?:\/[\d.]+)?)/g

/** @param {string} classText */
export function findBannedClassTokens(classText) {
  /** @type {string[]} */
  const banned = []
  for (const match of classText.matchAll(ARBITRARY)) {
    const token = match[1]
    if (!VARIANT_OK.test(token)) banned.push(token)
  }
  for (const match of classText.matchAll(PALETTE)) {
    banned.push(match[1])
  }
  return banned
}

/**
 * ESLint no-restricted-syntax selectors. Patterns must not contain a bare
 * `/` (esquery delimiter). Escape once for the RegExp inside `/.../`.
 */
export function restrictedSyntaxSelectors() {
  const arbitrary =
    "(?:^|\\s)(?!(?:[\\w-]+:)*(?:data|aria|has|group)-)(?:[\\w-]+:)*[\\w-]+-\\[[^\\]]+\\]"
  const palette =
    "(?:^|\\s)(?:[\\w-]+:)*(?:text|bg|border|ring|outline|fill|stroke|from|to|via)-(?:amber|red|blue|green|yellow|orange|purple|pink|indigo|violet|cyan|teal|lime|emerald|sky|fuchsia|rose|slate|gray|zinc|neutral|stone|white|black)(?:-\\d+)?"
  return [
    {
      selector: `Literal[value=/${arbitrary}/]`,
      message:
        "Avoid arbitrary Tailwind values in apps/web (use scale steps). data-/aria-/has-/group- variants are allowed.",
    },
    {
      selector: `TemplateElement[value.raw=/${arbitrary}/]`,
      message:
        "Avoid arbitrary Tailwind values in apps/web (use scale steps). data-/aria-/has-/group- variants are allowed.",
    },
    {
      selector: `Literal[value=/${palette}/]`,
      message:
        "Use semantic tokens (text-muted-foreground, bg-card, text-destructive), not palette colors.",
    },
    {
      selector: `TemplateElement[value.raw=/${palette}/]`,
      message:
        "Use semantic tokens (text-muted-foreground, bg-card, text-destructive), not palette colors.",
    },
  ]
}
