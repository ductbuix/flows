/**
 * Detects banned Tailwind class tokens in apps/web (DES-024, DES-025).
 * Arbitrary values are OK only under data-/aria-/has-/group- variants.
 */

const VARIANT_OK = /^(?:[\w-]+:)*(?:data|aria|has|group)-/
const ARBITRARY = /(?:^|[\s"'`])((?:[\w-]+:)*[\w/-]+-\[[^\]]+\])/g
const PALETTE =
  /(?:^|[\s"'`])((?:[\w-]+:)*(?:text|bg|border|ring|outline|fill|stroke|from|to|via)-(?:amber|red|blue|green|yellow|orange|purple|pink|indigo|violet|cyan|teal|lime|emerald|sky|fuchsia|rose|slate|gray|zinc|neutral|stone|white|black)(?:-\d+)?(?:\/[\d.]+)?)/g

/** Strip Tailwind variant prefixes (`dark:`, `data-[x]:`, …). */
function baseUtility(token) {
  return token.replace(/^(?:[\w-]+(?:\[[^\]]*\])?:)+/, "")
}

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
 * Size and radius utilities that must not override shadcn parts (DES-025).
 * @param {string} classText
 */
export function findBannedSizeRadiusTokens(classText) {
  /** @type {string[]} */
  const banned = []
  for (const token of classText.trim().split(/\s+/).filter(Boolean)) {
    const base = baseUtility(token)
    if (/^(?:h|size|rounded)-/.test(base)) banned.push(token)
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

/**
 * Layout primitives that need explicit height; size/radius still banned.
 * @type {ReadonlySet<string>}
 */
const LAYOUT_HEIGHT_OK = new Set([
  "Skeleton",
  "ScrollArea",
  "SidebarInset",
  "Separator",
  "Tabs",
  "TabsContent",
  "ResizablePanelGroup",
  "ResizablePanel",
])

/**
 * @param {string} name
 * @param {string[]} tokens
 */
function tokensForComponent(name, tokens) {
  let next = tokens
  // DES-024: Button variant="link" has no unpadded size; h-auto is accepted.
  if (name === "Button") {
    next = next.filter((token) => baseUtility(token) !== "h-auto")
  }
  if (LAYOUT_HEIGHT_OK.has(name)) {
    next = next.filter((token) => !/^h-/.test(baseUtility(token)))
  }
  return next
}

/**
 * Collect string literals from a className expression (incl. cn(...)).
 * @param {import('estree').Node | null | undefined} node
 * @param {(n: import('estree').Node) => void} visit
 */
function walkClassNameStrings(node, visit) {
  if (!node) return
  if (node.type === "Literal" && typeof node.value === "string") {
    visit(node)
    return
  }
  if (node.type === "TemplateLiteral") {
    for (const quasi of node.quasis) visit(quasi)
    for (const expr of node.expressions) walkClassNameStrings(expr, visit)
    return
  }
  if (node.type === "ConditionalExpression") {
    walkClassNameStrings(node.consequent, visit)
    walkClassNameStrings(node.alternate, visit)
    return
  }
  if (node.type === "LogicalExpression") {
    walkClassNameStrings(node.left, visit)
    walkClassNameStrings(node.right, visit)
    return
  }
  if (node.type === "CallExpression") {
    for (const arg of node.arguments) walkClassNameStrings(arg, visit)
  }
}

/**
 * @param {import('estree-jsx').JSXTagNameExpression} name
 * @returns {string | null}
 */
function jsxTagName(name) {
  if (name.type === "JSXIdentifier") return name.name
  if (name.type === "JSXMemberExpression") {
    return jsxTagName(name.property)
  }
  return null
}

/** ESLint rule: no h-/size-/rounded- tokens on @workspace/ui JSX parts. */
export const noUiSizeRadiusClassRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow className size/radius tokens on @workspace/ui components",
    },
    schema: [],
    messages: {
      banned:
        "Do not set size/radius via className on @workspace/ui/{{name}} ({{tokens}}). Use size/variant props.",
    },
  },
  create(context) {
    /** @type {Set<string>} */
    const uiNames = new Set()
    const filename = context.filename.replaceAll("\\", "/")
    if (filename.includes("/components/ai-elements/")) {
      return {}
    }

    return {
      ImportDeclaration(node) {
        if (
          typeof node.source.value !== "string" ||
          !node.source.value.startsWith("@workspace/ui")
        ) {
          return
        }
        for (const spec of node.specifiers) {
          uiNames.add(spec.local.name)
        }
      },
      JSXOpeningElement(node) {
        const name = jsxTagName(node.name)
        if (!name || !uiNames.has(name)) return

        for (const attr of node.attributes) {
          if (attr.type !== "JSXAttribute" || attr.name.name !== "className") {
            continue
          }
          const value = attr.value
          if (!value) continue

          /** @type {string[]} */
          const found = []
          if (value.type === "Literal" && typeof value.value === "string") {
            found.push(
              ...tokensForComponent(
                name,
                findBannedSizeRadiusTokens(value.value)
              )
            )
          } else if (value.type === "JSXExpressionContainer") {
            walkClassNameStrings(value.expression, (n) => {
              const text =
                n.type === "Literal" && typeof n.value === "string"
                  ? n.value
                  : n.type === "TemplateElement"
                    ? (n.value.cooked ?? n.value.raw)
                    : null
              if (text) {
                found.push(
                  ...tokensForComponent(name, findBannedSizeRadiusTokens(text))
                )
              }
            })
          }

          if (found.length > 0) {
            context.report({
              node: attr,
              messageId: "banned",
              data: { name, tokens: [...new Set(found)].join(", ") },
            })
          }
        }
      },
    }
  },
}
