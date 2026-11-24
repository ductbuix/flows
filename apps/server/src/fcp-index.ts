/** Same-origin index page that exposes the per-launch FCP token (DES-040). */

export function fcpIndexHtml(opts: { token: string; url: string }): string {
  const payload = JSON.stringify({ token: opts.token, url: opts.url })
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Flows</title>
</head>
<body>
<script>window.__FLOWS_FCP__=${payload};</script>
</body>
</html>
`
}
