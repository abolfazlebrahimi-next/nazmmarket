# Admin waitlist source

The admin waitlist page reads its list only from `GET /api/users`. It does not
read `users`, `seller_accounts`, or `courier_accounts` directly and does not
merge or backfill records from the local database.

## Request and proxy

The browser requests the relative path `/api/users` and sends the current admin
bearer session in the `Authorization` header. Relative URLs keep browser code
from calling `localhost` directly. In Vite development, `/api` is proxied to
`API_PROXY_TARGET`, which defaults to `http://127.0.0.1:4000`; in production the
API root comes from `VITE_API_BASE_URL` or the existing production default.

The UI sends no search, role, sort, or pagination query parameters because the
`/api/users` query contract was not available for verification. It applies
search, role filtering, alphabetical/phone sorting, and 30-row pagination to
the response it receives. Counts are computed from that same response and are
labelled as records received from the API, not as independent server totals.
CSV export also contains only the currently filtered records from that
response.

## Fields

The page uses only the supplied API record fields:

- `type` — customer, seller, or courier
- `phone`
- `firstName` / `first_name`
- `lastName` / `last_name`

The response may be an array, or an object containing `users`, `rows`, or `data`
(array); a nested `data.users` or `data.rows` is also accepted. Records without
`type` or `phone`, or responses without a record array, produce a visible error
instead of fabricated values. No status, registration date, waitlist ID, or
review action is inferred because those fields were not supplied.

## Admin session

The admin bearer token is kept in memory and `sessionStorage` for the current
browser tab. `sessionStorage` survives a page refresh but is cleared when the
tab session ends. The token is never placed in a URL or `localStorage`; logout
and an expired/invalid session clear it. A 401 can renew the active opaque admin
session through `/api/v1/admin/auth/refresh`; if it has expired, the admin must
log in again.

## Verification note

The provided local endpoint was not reachable from the coding workspace during
implementation, and this repository does not currently mount a `GET /api/users`
route (it has a separate, authenticated `/api/admin/users` route). The page is
configured to call the requested `/api/users` endpoint, but that endpoint and
its live payload must exist in the target backend for the list to load. No
fallback to the admin users route or the account tables is used.
