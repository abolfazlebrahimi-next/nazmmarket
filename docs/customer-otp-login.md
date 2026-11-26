# Unified customer login, signup, and password recovery

The storefront uses a single phone-first flow. A customer enters a mobile
number and verifies an SMS code. Existing customers receive the normal session
and enter the app; a new customer is asked for a display name and password only
after the phone is verified. The editable phone field is cleared when the code
step opens; the verified phone remains in component memory and is shown masked.

Password recovery requests a separate-purpose OTP for an existing customer.
After verification, the customer chooses a new password and is signed in with a
fresh session. Login, signup, and password-reset OTPs cannot be substituted for
one another. Password changes invalidate the user's other sessions.

## Backend configuration

Set these values only in the **Node.js backend's** private environment (for a
local checkout, `backend/.env`; for production, the backend host's secret/
environment settings):

```env
MELIPAYAMAK_OTP_URL=<new HTTPS OTP endpoint URL from MeliPayamak>
AUTH_OTP_HASH_KEY=<random persistent server-only key, at least 32 characters>
```

Generate `AUTH_OTP_HASH_KEY` with:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Do not put either value in frontend/Vite variables or commit them. The OTP URL
contains a provider credential in its path. Rotate any credential that appeared
in a screenshot before configuring the replacement. Do not send the replacement
credential in chat.

## OTP handling

The backend calls MeliPayamak with `{ "to": "09…" }`. It reads the provider's
`code` only on the server and stores a peppered hash. Codes expire after five
minutes, are single-use, and allow at most five wrong attempts. Resends are
limited to once per minute; request limits also apply by phone and IP. Short-
lived, random, purpose-bound challenge tokens authorize completing signup or
password reset after OTP verification. The `auth_otps` and
`auth_otp_challenges` tables are created/upgraded automatically on startup.

The provider's documented `status` values are not encoded as an allowlist; a
send is accepted only on HTTP success plus a 4–12 digit string or safe integer
in `code`. Check the provider panel's delivery report for actual handset
delivery. Backend `[auth:otp]` diagnostics show skipped/accepted/rejected
outcomes with redacted status previews; they never log the phone, OTP, or API
token.

## Routes

- `POST /api/auth/otp/request` — `{ "phone": "09…", "purpose": "login" }`
  sends a login/signup code. The same generic response is used for any valid
  number so account existence is not disclosed.
- `POST /api/auth/otp/verify` — `{ "phone": "09…", "code": "…" }`; existing
  customer → `{ token, user, addresses }`; new customer →
  `{ needsRegistration: true, signupToken }`.
- `POST /api/auth/otp/register` — `{ "signupToken": "…", "name": "…",
  "password": "…" }`; consumes the verified signup challenge and creates a
  customer session.
- `POST /api/auth/otp/request` with `purpose: "password_reset"` requests a
  reset code for an existing account, using the same generic response.
- `POST /api/auth/otp/verify-reset` — `{ "phone": "09…", "code": "…" }`;
  returns a short-lived `resetToken` after valid reset-purpose verification.
- `POST /api/auth/otp/reset-password` — `{ "resetToken": "…",
  "password": "…" }`; changes the password, invalidates old sessions, and
  returns a new customer session.

Direct customer `POST /api/auth/register` is deprecated and now requires the
OTP flow. The password login endpoint remains for compatibility; seller and
courier registration/login flows are unchanged.
