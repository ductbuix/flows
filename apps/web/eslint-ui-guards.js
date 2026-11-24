/**
 * UI guard rules for apps/web (DES-030): dense sizes, dialog widths, mono,
 * frame padding, and time formatting. Unit tests: src/lib/ui-guards.test.ts.
 */

const DENSE_SIZES = new Set(["sm", "xs", "icon-sm", "icon-xs"])
/** Card/Item `size` is layout density (DES-029/036), not a control size. */
const DENSE_SIZE_LAYOUT = new Set(["Card", "Item"])
const DENSE_ANCESTORS = new Set([
  "TableCell",
  "TableHead",
  "ItemActions",
  "InputGroupAddon",
  "CodeBlockHeader",
])
const DENSE_FILE = /(?:Graph|Node|IdText)\.tsx$|\/ai-elements\//
const DIALOG_WIDTHS = new Set(["sm:max-w-md", "sm:max-w-xl"])
const WIDTH_TOKEN = /^(?:[\w-]+:)*(?:min-|max-)?w-/
const MONO_OK =
  /\/components\/(?:data|ai-elements)\/|\/StartRunFormFields\.tsx$/
const FRAME_PADDING = /^(?:[\w-]+:)*(?:p|px|py)-6$/
const TIME_CALLS = new Set([
  "toISOString",
  "toLocaleString",
  "toLocaleDateString",
])

/** @param {string} filename */
const norm = (filename) => filename.replaceAll("\\", "/")

/** @param {import('estree-jsx').JSXTagNameExpression} name */
function tagName(name) {
  if (name.type === "JSXIdentifier") return name.name
  if (name.type === "JSXMemberExpression") return tagName(name.property)
  return null
}

/** @param {string} text */
const tokens = (text) => text.split(/\s+/).filter(Boolean)

/** Names imported from `@workspace/ui/*` in the file. */
function uiImports(context) {
  const names = new Set()
  return {
    names,
    visit(node) {
      if (String(node.source.value).startsWith("@workspace/ui")) {
        for (const spec of node.specifiers) names.add(spec.local.name)
      }
    },
  }
}

/** Text of every string literal and template chunk under a node. */
function stringsOf(node, out = []) {
  if (!node || typeof node !== "object") return out
  if (node.type === "Literal" && typeof node.value === "string") {
    out.push(node.value)
  } else if (node.type === "TemplateElement") {
    out.push(node.value.cooked ?? node.value.raw)
  } else if (node.type === "JSXExpressionContainer") {
    stringsOf(node.expression, out)
  } else if (node.type === "TemplateLiteral") {
    for (const q of node.quasis) stringsOf(q, out)
    for (const e of node.expressions) stringsOf(e, out)
  } else if (node.type === "ConditionalExpression") {
    stringsOf(node.consequent, out)
    stringsOf(node.alternate, out)
  } else if (node.type === "LogicalExpression") {
    stringsOf(node.left, out)
    stringsOf(node.right, out)
  } else if (node.type === "CallExpression") {
    for (const a of node.arguments) stringsOf(a, out)
  }
  return out
}

function classNameText(node) {
  const attr = node.attributes.find(
    (a) => a.type === "JSXAttribute" && a.name.name === "className"
  )
  return attr ? stringsOf(attr.value).join(" ") : ""
}

/** Dense `size` only inside dense containers. */
export const denseSizeRule = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      dense:
        'size="{{size}}" on {{name}} is for dense places only (table cells, item actions, input addons, sidebar, code headers). Use the default size.',
    },
  },
  create(context) {
    if (DENSE_FILE.test(norm(context.filename))) return {}
    const ui = uiImports(context)
    return {
      ImportDeclaration: ui.visit,
      JSXOpeningElement(node) {
        const name = tagName(node.name)
        if (!name || !ui.names.has(name)) return
        if (DENSE_SIZE_LAYOUT.has(name)) return
        const attr = node.attributes.find(
          (a) => a.type === "JSXAttribute" && a.name.name === "size"
        )
        if (!attr || attr.value?.type !== "Literal") return
        const size = String(attr.value.value)
        if (!DENSE_SIZES.has(size)) return
        const dense = context.sourceCode.getAncestors(node).some((a) => {
          if (a.type !== "JSXElement") return false
          const n = tagName(a.openingElement.name)
          return !!n && (DENSE_ANCESTORS.has(n) || n.startsWith("Sidebar"))
        })
        if (!dense)
          context.report({
            node: attr,
            messageId: "dense",
            data: { size, name },
          })
      },
    }
  },
}

/** DialogContent: sm:max-w-md or sm:max-w-xl only; Sheet/AlertDialog: none. */
export const dialogWidthRule = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      width:
        "{{name}} width {{token}} is not allowed. DialogContent takes sm:max-w-md or sm:max-w-xl; SheetContent and AlertDialogContent take none.",
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        const name = tagName(node.name)
        if (
          name !== "DialogContent" &&
          name !== "SheetContent" &&
          name !== "AlertDialogContent"
        ) {
          return
        }
        for (const token of tokens(classNameText(node))) {
          if (!WIDTH_TOKEN.test(token)) continue
          if (name === "DialogContent" && DIALOG_WIDTHS.has(token)) continue
          context.report({ node, messageId: "width", data: { name, token } })
        }
      },
    }
  },
}

/** Reports class tokens found in any string literal. */
function classTokenRule(test, message, allowFile) {
  return {
    meta: { type: "problem", schema: [], messages: { banned: message } },
    create(context) {
      if (allowFile?.(norm(context.filename))) return {}
      const check = (node, text) => {
        for (const token of tokens(text)) {
          if (test(token)) {
            context.report({ node, messageId: "banned", data: { token } })
          }
        }
      }
      return {
        Literal(node) {
          if (typeof node.value === "string") check(node, node.value)
        },
        TemplateElement(node) {
          check(node, node.value.cooked ?? node.value.raw)
        },
      }
    },
  }
}

export const monoRule = classTokenRule(
  (t) => /^(?:[\w-]+:)*font-mono$/.test(t),
  "font-mono is limited to components/data and ai-elements. Use the `mono` class from @/components/data/mono or IdText.",
  (file) => MONO_OK.test(file)
)

export const framePaddingRule = {
  ...classTokenRule(
    (t) => FRAME_PADDING.test(t),
    "Frame padding {{token}} belongs to components/page. Use Page, PageSection or PageToolbar.",
    (file) => file.includes("/components/page/")
  ),
}

/** Pages never render `main` or `header`; the Page frame owns them. */
export const pageFrameTagsRule = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      tag: "Pages never render <{{name}}>; use Page and PageHeader.",
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        const name = tagName(node.name)
        if (name === "main" || name === "header") {
          context.report({ node, messageId: "tag", data: { name } })
        }
      },
    }
  },
}

/** Time formatting goes through RelativeTime / lib/labels, not in pages. */
export const noTimeFormatRule = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      time: "{{name}} is not allowed under pages/. Use RelativeTime.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee
        if (
          callee.type === "MemberExpression" &&
          callee.property.type === "Identifier" &&
          TIME_CALLS.has(callee.property.name)
        ) {
          context.report({
            node,
            messageId: "time",
            data: { name: callee.property.name },
          })
        }
      },
    }
  },
}

export const uiGuardPlugin = {
  rules: {
    "dense-size": denseSizeRule,
    "dialog-width": dialogWidthRule,
    mono: monoRule,
    "frame-padding": framePaddingRule,
    "page-frame-tags": pageFrameTagsRule,
    "no-time-format": noTimeFormatRule,
  },
}
