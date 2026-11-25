# Customer login with MeliPayamak OTP

The storefront login flow now asks for a phone number, requests an OTP from the
Node.js backend, then verifies the entered code and creates the existing
customer session. Registration is unchanged and still uses its current password
flow.

## Backend configuration

Set these values in the **Node.js backend's** private environment (for a local
checkout, `backend/.env`; for production, the backend host's secret/environment
settings):

```env
MELIPAYAMAK_OTP_URL=<new HTTPS OTP endpoint URL from MeliPayamak>
AUTH_OTP_HASH_KEY=<random persistent server-only key, at least 32 characters>
```

Generate `AUTH_OTP_HASH_KEY` with:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Do not place either value in frontend/Vite variables or commit them. The OTP
endpoint URL contains a provider credential in its path. Rotate the credential
shown in the shared screenshot before configuring the replacement on the
backend. Do not send the replacement credential in chat.

The backend calls the MeliPayamak OTP send endpoint with `{ "to": "09…" }`.
It reads the provider's `code` only on the server, stores a peppered hash, and
never returns the OTP to the browser or logs it. A code expires after five
minutes, can be used once, and permits at most five verification attempts;
resends are limited to once per minute. The backend migration creates the
`auth_otps` table automatically on startup.

The provider's documented `status` values were not available in the shared
configuration, so the send handler currently treats an HTTP-success response
with a 4–12 digit `code` (string or safe integer) as successful and does not
interpret `status`. Confirm the actual response on a test phone before
production and adjust the status check if the panel defines additional
success/failure states. If sending returns HTTP 502, check the backend terminal
for a sanitized `[auth:otp]` diagnostic; it never includes the OTP, phone, or
provider token. If the panel requires enabling OTP sending, a template, or a
sender line, enable that there; no provider credentials or panel settings
belong in the frontend.

## Routes

- `POST /api/auth/otp/request` — `{ "phone": "09…" }`; sends only for an
  existing customer and returns a generic response to avoid account discovery.
- `POST /api/auth/otp/verify` — `{ "phone": "09…", "code": "…" }`; on success
  returns the same `{ token, user, addresses }` shape as the existing login.

The legacy password login route remains available for compatibility, but the
main storefront login UI uses OTP. Other panels and seller/courier login flows
are unchanged.
