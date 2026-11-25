# Admin waitlist: PHP-host API integration

Only the Waitlist page uses the PHP API. The existing Node.js login and all
other admin pages keep their existing API client and behavior. No Node.js
backend files are changed for this integration.

## API origin and CORS

The page uses `VITE_WAITLIST_API_BASE_URL`, defaulting to
`https://nazarabadshop.ir/api`. It does not use the Node.js Vite `/api` proxy.
The optional `.env.example` value is a public API origin only; never put admin
credentials, JWT secrets, access tokens, or refresh tokens in a Vite variable.

Because the browser calls the PHP host directly, the PHP host must allow the
admin origin in `CORS_ALLOWED_ORIGINS`:

- Development: `http://localhost:5176`
- Production: only the actual deployed admin-panel origin

Do not use a wildcard. The PHP middleware must also allow the required
`Authorization` and `Content-Type` headers and the `GET`, `POST`, `PATCH`,
`DELETE`, and `OPTIONS` methods. This repository contains no PHP
`CorsMiddleware` or PHP configuration, so the host setting cannot be changed or
verified here.

## PHP endpoints used

All JSON API operations require the documented success envelope:

```json
{ "success": true, "data": {}, "meta": {} }
```

and failures are read from:

```json
{ "success": false, "error": { "code": "...", "message": "..." } }
```

The page uses these routes:

- `POST /v1/admin/auth/login` with `{ "username", "password" }`
- `POST /v1/admin/auth/refresh` with `{ "refresh_token" }`
- `POST /v1/admin/auth/logout` with `{ "refresh_token" }`
- `GET /v1/admin/waitlist` with `page`, `per_page`, `q`, optional `role` and
  `status`, plus `sort` and `order`
- `GET /v1/admin/waitlist/{id}`
- `PATCH /v1/admin/waitlist/{id}` with only the editable snake-case fields
- `DELETE /v1/admin/waitlist/{id}`
- `GET /v1/admin/stats`
- `GET /v1/admin/export` (CSV downloaded from the host; no export filters are
  sent because the supplied contract does not confirm that export accepts them)

The **JSON** button builds a JSON file from all pages of the PHP waitlist list
endpoint using the current search/filter/sort values. It includes normalized
records, applied filters, and—when available—the latest raw stats response
envelope. Access and refresh tokens are never included. The file contains user
names and phone numbers; handle it as private data. The CSV button continues to
use the host export endpoint.

List rows are read only from `response.data.items`; page metadata is read from
`response.meta`. The UI validates the documented user fields and enum values
instead of substituting Node.js account data. The pager recognizes the common
`current_page`, `per_page`, `total`, and `last_page` metadata fields; if the PHP
API uses different metadata names, it shows a clear error rather than claiming
incorrect totals or page counts.

## PHP session isolation

PHP access and refresh tokens use distinct `sessionStorage` keys and are never
shared with the Node.js session. The access token is sent only as
`Authorization: Bearer <access_token>` for protected API routes. Login passwords
are sent for the login request only and are not stored. A single in-flight
refresh promise is shared across simultaneous 401 responses; a successful
refresh stores both rotated tokens and retries each original request once. If
refresh fails, both tokens are cleared and the PHP login form is shown again.
PHP logout posts the refresh token and clears local PHP session storage whether
the host is reachable or not.

## Contract assumptions still requiring confirmation

The supplied request identifies the routes and the response envelope, but the
PHP implementation was not available here to confirm every field. The current
client therefore expects the login body `{ "username", "password" }`, list
query keys `page`, `per_page`, `q`, `role`, `status`, `sort`, and `order`, the
role values `customer`, `seller`, `courier`, the status values `registered`,
`contacted`, `approved`, `rejected`, and stats values `total`, `customers`,
`sellers`, `couriers` at `data` or `data.stats`. It accepts common page metadata
keys but these are not verified. If the stats endpoint succeeds but its fields
do not match those expected names, the raw envelope is retained for JSON export
and the summary cards remain blank; this is not shown as a network/API failure.
List-row or pagination contract mismatches still produce a visible error.

## Verification limits

The repository has no PHP source tree or PHP tests, and the external host could
not be accessed from this workspace. Endpoint connectivity, exact login and
filter parameters, enum values, pagination metadata, stats shape, CSV response
content type, and live CORS headers could not be verified here. The React app
can be typechecked and built locally; for live browser access, set the PHP
host's `CORS_ALLOWED_ORIGINS` as described above. Please provide representative
success JSON for login, list (including `meta`), stats, plus the accepted role
and status values to finalize mappings without guessing.
