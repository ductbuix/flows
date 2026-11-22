import { RuleTester } from "eslint"
import tseslint from "typescript-eslint"
import { describe, it } from "vitest"
import {
  denseSizeRule,
  dialogWidthRule,
  framePaddingRule,
  monoRule,
  noTimeFormatRule,
  pageFrameTagsRule,
} from "../../eslint-ui-guards.js"

RuleTester.describe = describe
RuleTester.it = it
RuleTester.itOnly = it.only

const tester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

const page = "/repo/apps/web/src/pages/Foo.tsx"
const imp = 'import { Button } from "@workspace/ui/components/button"\n'

tester.run("dense-size", denseSizeRule, {
  valid: [
    { filename: page, code: `${imp}<TableCell><Button size="sm" /></TableCell>` },
    { filename: page, code: `${imp}<ItemActions><Button size="icon-xs" /></ItemActions>` },
    { filename: page, code: `${imp}<Button />` },
    {
      filename: "/repo/apps/web/src/pages/run-view/TaskGraph.tsx",
      code: `${imp}<Button size="sm" />`,
    },
  ],
  invalid: [
    {
      filename: page,
      code: `${imp}<div><Button size="sm" /></div>`,
      errors: [{ messageId: "dense" }],
    },
  ],
})

tester.run("dialog-width", dialogWidthRule, {
  valid: [
    { code: '<DialogContent className="sm:max-w-md" />' },
    { code: '<DialogContent className="sm:max-w-xl p-0" />' },
    { code: "<SheetContent />" },
    { code: "<AlertDialogContent size={x} />" },
  ],
  invalid: [
    {
      code: '<DialogContent className="sm:max-w-2xl" />',
      errors: [{ messageId: "width" }],
    },
    {
      code: '<SheetContent className="sm:max-w-md" />',
      errors: [{ messageId: "width" }],
    },
    {
      code: '<AlertDialogContent className="w-96" />',
      errors: [{ messageId: "width" }],
    },
  ],
})

tester.run("mono", monoRule, {
  valid: [
    { filename: "/repo/apps/web/src/components/data/IdText.tsx", code: 'x("font-mono")' },
    { filename: "/repo/apps/web/src/components/ai-elements/a.tsx", code: 'x("font-mono")' },
    { filename: page, code: 'x("text-sm")' },
  ],
  invalid: [
    { filename: page, code: '<p className="font-mono text-sm" />', errors: [{ messageId: "banned" }] },
  ],
})

tester.run("frame-padding", framePaddingRule, {
  valid: [
    { filename: "/repo/apps/web/src/components/page/Page.tsx", code: 'x("px-4 lg:px-6")' },
    { filename: page, code: 'x("px-4 p-3")' },
  ],
  invalid: [
    { filename: page, code: '<div className="lg:px-6" />', errors: [{ messageId: "banned" }] },
    { filename: page, code: '<div className="p-6" />', errors: [{ messageId: "banned" }] },
  ],
})

tester.run("page-frame-tags", pageFrameTagsRule, {
  valid: [{ code: "<div />" }],
  invalid: [
    { code: "<main />", errors: [{ messageId: "tag" }] },
    { code: "<header />", errors: [{ messageId: "tag" }] },
  ],
})

tester.run("no-time-format", noTimeFormatRule, {
  valid: [{ code: "x.getTime()" }],
  invalid: [
    { code: "d.toISOString()", errors: [{ messageId: "time" }] },
    { code: "d.toLocaleString()", errors: [{ messageId: "time" }] },
    { code: "d.toLocaleDateString()", errors: [{ messageId: "time" }] },
  ],
})
