# Admin waitlist API

The independent admin interface uses the versioned API rooted at
`https://nazarabadshop.ir/api` in production. In local development, the Vite
proxy sends `/api` to the backend at `127.0.0.1:4000` unless
`VITE_API_BASE_URL` is overridden.

## Registration data and persistence

The repository stores registrations in three existing MySQL tables:

- `users` → `customer`
- `seller_accounts` → `seller`
- `courier_accounts` → `courier`

The `admin_waitlist_entries` table provides a stable, globally unique waitlist
ID and stores the admin's review status. Existing accounts are backfilled once
when the backend migrates the schema. Customer-, seller- and courier-registration
handlers add new entries in the same database transaction as the account. No
customer-facing page or registration form is changed.

Names, phone numbers and signup dates are read from those source tables. Seller
and courier source records only have a single full-name field, so the API returns
that in `firstName` and an empty `lastName`; it does not split or invent a name.
The source tables do not track profile `updated_at`. `updatedAt` is therefore
`null` until the waitlist review status changes, and afterwards represents the
last waitlist-status update only. It is not presented as a profile edit time.

New/backfilled entries start with `registered`, the only review state available
before an admin has recorded an action. Review statuses are stored separately
from account activation/KYC: changing this waitlist state does not approve a
seller store or activate a courier.

## Routes

All waitlist routes require `Authorization: Bearer <admin-session-token>` and
return `Cache-Control: no-store`.

- `POST /v1/admin/auth/login` — JSON `{ "username": "...", "password": "..." }`; returns `{ "token", "expiresAt" }`.
- `POST /v1/admin/auth/refresh` — sends the current live bearer token; renews the
  database-backed session and returns `{ "token", "expiresAt" }`.
- `POST /v1/admin/auth/logout` — revokes the bearer session.
- `GET /v1/admin/waitlist` — accepts `page`, `size` (1–100), `q`, `role`
  (`all|customer|seller|courier`), `status`
  (`all|registered|contacted|approved|rejected`) and `sort` (`newest|oldest`).
  Returns `{ rows, total, page, size }`.
- `GET /v1/admin/waitlist/stats` — returns `{ stats, dateBasis: "UTC" }`.
- `GET /v1/admin/waitlist/{id}` — returns `{ entry }`.
- `PATCH /v1/admin/waitlist/{id}` — accepts only `{ "status": "registered|contacted|approved|rejected" }` and returns `{ ok, entry }`.
- `GET /v1/admin/waitlist/export` — accepts the same query filters and streams
  UTF-8 CSV with a BOM for spreadsheet compatibility.

List responses use this entry shape:

```json
{
  "id": "1",
  "role": "customer",
  "firstName": "...",
  "lastName": "...",
  "phone": "09...",
  "status": "registered",
  "createdAt": "2026-11-25T00:00:00.000Z",
  "updatedAt": null
}
```

The login and refresh endpoints share the existing opaque, database-backed
admin session system. This backend does **not** use JWTs or issue a separate
refresh-token pair; an active bearer session is extended for eight hours, and an
expired session requires a fresh login. The frontend keeps the bearer token in
memory only (never in a URL or Web Storage), so a full page reload requires a
new login. Admin credentials must be configured on
the backend through `ADMIN_USERNAME` and `ADMIN_PASSWORD_HASH`; there is no
built-in admin password.

## Deployment and checks

The backend runs its idempotent schema migration at startup. Deploy the backend
changes before the admin static build so `/api/v1/admin/...` exists. Set
`VITE_API_BASE_URL` at build time only if the API root differs from the default;
this value is an origin/path, not a secret. Never put admin credentials, database
credentials, or session tokens in frontend build variables.

Run the admin UI checks from `admin-frontend/`:

```sh
npm ci
npm run typecheck
npm run build
```

Run the backend route/unit checks from `backend/` with `npm test`. The MySQL
integration test requires `RUN_MYSQL_TESTS=1`, a dedicated database whose name
ends in `_test`, and a reachable MySQL 8 server; it is skipped otherwise.
