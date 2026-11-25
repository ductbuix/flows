# apps/web — Inbox (`/inbox`)

Part of the [web spec](web.md). Open decisions from runs (approvals,
permissions, questions, plan reviews, sign-ins). Files:
`src/pages/inbox/*` (6 source files). The sidebar badge and in-app toasts
for the same data live in the shell ([web-settings-shell.md](web-settings-shell.md)).

## File map

| File                         | Exports                                                    | Role                                     |
| ---------------------------- | ---------------------------------------------------------- | ---------------------------------------- |
| `InboxPage.tsx`              | `InboxPage`                                                | Route element                            |
| `InboxStates.tsx`            | `InboxLoading`, `InboxLoadError`, `InboxEmpty`             | States                                   |
| `InboxItemCard.tsx`          | `InboxItemCard`                                            | One item, with meta and per-kind actions |
| `InboxQuestionActions.tsx`   | `InboxQuestionActions`                                     | Multi-question option picker             |
| `InboxPlanReviewActions.tsx` | `InboxPlanReviewActions`                                   | Plan text, todos, accept/reject          |
| `inbox-actions.ts`           | `answerInboxItem`, `dismissInboxItem`, `InboxActionResult` | FCP calls with error mapping             |

## FCP

| Method                              | Params                                                                        | Notes           |
| ----------------------------------- | ----------------------------------------------------------------------------- | --------------- |
| `inbox/list` (query, topic `inbox`) | `{}` → `{ items: WireInboxItem[] }`                                           | Open items only |
| `inbox/answer`                      | `{ itemId, optionId, answers?: {questionId, selectedOptionIds: string[]}[] }` |                 |
| `inbox/dismiss`                     | `{ itemId }`                                                                  |                 |

`WireInboxItem` is a union on `kind`: `approval`, `permission` (has
`tool`), `question` (has `questions[]` each `{id, prompt, options[{id,label}], allowMultiple?}`),
`plan_review` (has `overview?`, `plan`, `todos[{id, status, content}]`),
`sign_in` (has `connectorId`, no run). Non-sign-in items have `runId`,
`workflowId?`, `pass`. All have `id`, `question`, `at`.

### inbox-actions.ts

```ts
export type InboxActionResult = "ok" | "conflict" | string
export function answerInboxItem(
  client,
  params: { itemId; optionId; answers? }
): Promise<InboxActionResult>
export function dismissInboxItem(
  client,
  itemId: string
): Promise<InboxActionResult>
```

Errors map to `"conflict"` when `isConflictError(err)` or when the error is
"already answered": `err.code === ErrorCode.not_found` or
`err.data.code === "not_found"`. Otherwise `errorMessage(err)`.

## InboxPage

- Same gate pattern as Docket: inner page directly when a client exists,
  otherwise inside `FlowsClientGate`.
- Query `inbox/list {}` topics `["inbox"]`. State `conflict`, `actionError`.
- Loading (`loading && !data`) → `InboxLoading`. Error without data → `InboxLoadError`.
- `<Page crumbs=[{label:"Inbox"}] data-testid="inbox-page">` (no `fill`):
  - `PageTitle title="Inbox" description="Runs waiting for you to approve or reject a step."`
  - Alert `data-testid="inbox-conflict"` (destructive): **Conflict** / **This item was already answered. Refresh to see what is left.**, or **Could not update** / message. Conflict clears actionError and vice versa.
  - `h2.font-heading.text-base.font-medium` **Needs you** followed by `span.ml-2.text-muted-foreground` with the count.
  - Empty → `InboxEmpty`; else `div.flex.max-w-2xl.flex-col.gap-3` of `InboxItemCard`.

### InboxStates

| Component                 | Content                                                                                                                                              |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `InboxLoading`            | description **Loading inbox…**; `div.flex.max-w-2xl.flex-col.gap-3 data-testid="inbox-loading"` with Skeletons `h-8 w-40`, `h-40 w-full` ×2          |
| `InboxLoadError({error})` | description **Could not load the inbox.**; Alert destructive `inbox-error` **Error** + message                                                       |
| `InboxEmpty`              | `Empty className="ring-1 ring-foreground/10" data-testid="inbox-empty"`, icon `Inbox`, **Nothing needs you** / **Approvals from runs show up here.** |

## InboxItemCard

Props: `item: WireInboxItem, onConflict(), onError(message)`. Local `busy`.

- Shell: `div.flex.flex-col.gap-3.rounded-3xl.bg-card.p-4.ring-1.ring-foreground/10 data-testid="inbox-item-<id>"`.
- Head (`flex flex-col gap-1`):
  - `item.question` in `font-heading text-base font-medium`.
  - Meta `text-sm text-muted-foreground`: sign_in → mono `connectorId` · `RelativeTime(at)`; others → `"<workflowId> · "` (if any) + mono `runId` + `· #<pass> ·` + `RelativeTime(at)`.
  - Kind badge (`Badge outline w-fit`): permission → `item.tool`; question → **Question**; plan_review → **Plan**.
- `answer(optionId, answers?)` → `answerInboxItem`; `dismiss()` → `dismissInboxItem`. Both set `busy` around the call and route results to `onConflict` / `onError`.
- Actions by kind (all buttons disabled while busy):

| Kind          | Buttons (variant, testid, text, optionId)                                                                                                                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `approval`    | default `inbox-approve-<id>` (`Check`) **Approve** → `approved`; outline `inbox-reject-<id>` (`X`) **Reject** → `rejected`; ghost `inbox-dismiss-<id>` **Dismiss**                                                            |
| `permission`  | default `inbox-allow-once-<id>` (`Check`) **Allow once** → `allow-once`; outline `inbox-allow-always-<id>` **Always allow** → `allow-always`; outline `inbox-reject-<id>` (`X`) **Reject** → `reject-once`; ghost **Dismiss** |
| `sign_in`     | ghost `inbox-dismiss-<id>` **Dismiss** only                                                                                                                                                                                   |
| `question`    | `InboxQuestionActions` (answer → optionId `answered` + answers; skip → `skipped`)                                                                                                                                             |
| `plan_review` | `InboxPlanReviewActions` (accept → `accepted`; reject → `rejected`)                                                                                                                                                           |

- For approval/permission rows (`flex flex-wrap items-center gap-2`), plus
  when `workflowId` exists: ghost `ml-auto` link Button **Open run** to
  `/workflows/<workflowId>?run=<runId>` (`nativeButton={false}`, `render=<Link>`).

### InboxQuestionActions

Props: `item, busy, onAnswer(answers), onSkip, onDismiss`.

- State `selected: Record<questionId, optionId[]>` starting empty per question.
- Per question: `span.text-sm.font-medium` prompt, then options as Buttons
  (`default` when selected else `outline`), `data-testid="inbox-qopt-<itemId>-<questionId>-<optionId>"`.
  Multi (`allowMultiple === true`) toggles membership; single toggles the one choice (click again clears).
- Footer: **Answer** (`inbox-answer-<id>`, `Check`, disabled until every question has ≥1 selection) sends all questions in order; outline **Skip** (`inbox-skip-<id>`, `X`); ghost **Dismiss**; ghost **Open run** link when `workflowId`.

### InboxPlanReviewActions

Props: `item, busy, onAccept, onReject, onDismiss`.

- `overview` paragraph (sm muted) if present.
- `pre.max-h-48.overflow-auto.rounded-xl.bg-muted/40.p-3.text-sm.whitespace-pre-wrap` with `plan`.
- Todos list `ul.flex.flex-col.gap-1.text-sm`: each `li.flex.gap-2` with muted `status` then `content`.
- Buttons: **Accept** (`inbox-accept-<id>`, `Check`), outline **Reject** (`inbox-reject-<id>`, `X`), ghost **Dismiss**, ghost **Open run** link when `workflowId`.
