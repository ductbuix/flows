/** WebSocket URL for the API, same host as the page (Vite proxies /api). */
export function apiWebSocketUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:"
  return `${proto}//${window.location.host}/api/ws`
}
