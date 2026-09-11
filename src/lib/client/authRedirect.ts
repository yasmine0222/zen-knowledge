/** A stateless JWT session can outlive its user row (e.g. after a re-seed).
 * Any authenticated fetch that comes back 401 means the session is stale —
 * bounce to /login instead of showing a raw error. */
export function redirectToLoginIfUnauthorized(response: Response): boolean {
  if (response.status === 401) {
    // Full reload, not router.push: client state (chat history, form state)
    // was built against the now-invalid session and must not survive.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
    return true;
  }
  return false;
}
