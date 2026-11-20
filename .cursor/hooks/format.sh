#!/usr/bin/env bash
# Cursor afterFileEdit hook: prettier --write, then eslint --fix on the edited file.
# Reads {"file_path": "..."} from stdin. Always exits 0 so it never blocks the agent.
set -u

root="${CURSOR_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
payload="$(cat)"

if command -v jq >/dev/null 2>&1; then
  file="$(printf '%s' "$payload" | jq -r '.file_path // empty' 2>/dev/null)"
else
  file="$(printf '%s' "$payload" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).file_path||"")}catch{}})' 2>/dev/null)"
fi

[ -n "${file:-}" ] && [ -f "$file" ] || exit 0

case "$file" in
  "$root"/*) ;;
  *) exit 0 ;;
esac
case "$file" in
  */node_modules/* | */dist/* | */.turbo/* | */test-results/* | */playwright-report/*) exit 0 ;;
esac

case "$file" in
  *.ts | *.tsx | *.js | *.jsx | *.mjs | *.cjs) lint=1 ;;
  *.json | *.md | *.mdc | *.css | *.yaml | *.yml | *.html) lint=0 ;;
  *) exit 0 ;;
esac

"$root/node_modules/.bin/prettier" --write --log-level warn "$file" >&2 || true

if [ "$lint" = 1 ]; then
  # Run eslint from the nearest package that has its own flat config.
  dir="$(dirname "$file")"
  while [ "$dir" != "$root" ] && [ "$dir" != "/" ]; do
    if [ -f "$dir/eslint.config.js" ] && [ -x "$dir/node_modules/.bin/eslint" ]; then
      (cd "$dir" && ./node_modules/.bin/eslint --fix --no-warn-ignored "$file" >&2) || true
      break
    fi
    dir="$(dirname "$dir")"
  done
fi

# Keep generated docs indexes in sync with frontmatter.
case "$file" in
  "$root"/docs/*.md) "$root/packages/docs-tools/node_modules/.bin/tsx" "$root/packages/docs-tools/src/cli.ts" index >&2 || true ;;
esac

exit 0
