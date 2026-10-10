/** Cloudflare Access handles login; Sign out clears the Access session. */

export function logout(): void {
  const returnTo = `${window.location.origin}/admin/`
  window.location.href = `/cdn-cgi/access/logout?returnTo=${encodeURIComponent(returnTo)}`
}
