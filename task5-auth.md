# Task 5 — Administrator Login, Passwords and Passkeys

**Goal:** Protect every admin API endpoint and let the administrator sign in using either a password or a registered passkey. The public website still reads published content without logging in.

**Order:** Finish the Task 4 API locally, then complete this task before connecting the admin UI to an exposed API or deploying it. Task 4's unauthenticated admin routes are **local development only**.

**Estimate:** 6–10 hours for a first implementation and focused tests, depending on experience. Passkeys, sessions, and recovery are significant additions to the one-night MVP; do not skip their security checks to meet a deadline.

## How passkeys fit in

A passkey is a WebAuthn credential. Your server stores a public key and credential metadata; the device or password manager holds the private key. Registration and login each have two steps: ask the server for a challenge, then submit the browser's signed response for server-side verification. A passkey is **not** a password or a replacement for the API session: successful passkey verification creates the same session as successful password login.

For this MVP, users enter their email first and then select **Sign in with password** or **Sign in with passkey**. An administrator signs in with a password to register their first passkey. Password login remains the fallback if a passkey is lost.

## 1. Agree on local origins before writing code

1. Pick a stable hostname and stick to it: use `localhost`, not a mixture of `localhost` and `127.0.0.1`. WebAuthn binds credentials to the relying-party ID (RP ID) and browser origin.
2. In development, the admin may run at `http://localhost:4200` and API at `http://localhost:6969`, with RP ID `localhost` and expected origin `http://localhost:4200`. Localhost is a secure-context exception; other deployments need HTTPS.
3. Prefer serving the admin and API under one HTTPS origin in production (e.g. admin at `https://admin.example.com`, API under `/api`). Set the production RP ID to the admin hostname and the expected origin to the exact HTTPS origin. RP IDs are hostnames, **not** URLs or ports.
4. Store the configured RP ID, exact allowed origin, access-token settings, and cookie settings in environment configuration. Document non-secret examples in `.env.example`; never commit token signing secrets.
5. A passkey registered with `localhost` won't be valid for a different production RP ID. Plan to register production passkeys on the production domain.

## 2. Add the user and credential models

- Add a `User` model with stable ID, normalized unique email, Argon2id password hash, role (`admin` initially), `isActive`, and timestamps. Do not store plaintext passwords.
- Add a `PasskeyCredential` model with an indexed, globally unique credential ID, user ID, public key, signature counter, transports, device/backup metadata where supplied by your WebAuthn library, and creation/last-used timestamps. Store binary values in a format supported by the library and MongoDB.
- Add a session/refresh-token model with user ID, a **hash** of the refresh token, expiry, revocation status, and enough metadata to rotate and revoke sessions. Do not log or persist raw refresh tokens.
- Add a short-lived, single-use challenge/flow record for registration and authentication, with an expiry, operation type, and binding to the relevant browser flow and user. Add a TTL index as cleanup, but also check expiry in application logic: TTL deletion is not immediate.

## 3. Bootstrap the first administrator

- Create a **local-only CLI command**, not a public signup route, to create the first administrator. Take the email and a password through a secure interactive prompt or protected environment input; hash the password with Argon2id. Never hardcode the password, print it, pass it in command-line arguments, or commit it.
- Enforce normalized-email uniqueness and make repeated bootstrap attempts fail clearly rather than resetting an existing account.
- Document how the owner can recover access if both password and passkeys are lost. For the MVP, a restricted server-side recovery CLI that resets a password after verifying an operator's server access is acceptable; revoke existing sessions on reset. A user-facing emailed password-reset flow remains required by the full spec but is **not** implemented in this task.

## 4. Password authentication and session lifecycle

- `POST /api/v1/auth/login`: accept email and password, validate the input, look up an active user, and verify the Argon2id hash. Return a generic failure for a wrong email or password; don't disclose whether an account exists. Rate-limit attempts and avoid logging credentials.
- Issue a short-lived signed access token (e.g. JWT with a fixed algorithm, expiration and subject) and a longer-lived random refresh token. Send the refresh token in an `HttpOnly`, `SameSite` cookie; use `Secure` under HTTPS. Return the access token to the admin client and keep it in memory, not localStorage.
- `POST /api/v1/auth/refresh`: validate and atomically rotate the refresh token, revoke the old one, and issue a new access token and cookie. Expired, revoked, or reused tokens must fail. `POST /api/v1/auth/logout` revokes the session and clears the cookie. `GET /api/v1/auth/me` returns the authenticated user without hashes or credential secrets.
- Treat refresh and logout as cookie-authenticated requests: enforce an exact allowed Origin and a CSRF defense (e.g. a synchronizer token), and configure credentialed CORS only for the explicit admin origin. Never combine credentials with wildcard CORS.
- If admin and API are on separate local ports, use the browser's credentialed requests and ensure your CORS/cookie setup supports them. HTTPS and correct cookie attributes are required outside localhost.

## 5. Add authentication and authorization middleware

1. Verify the access token's signature, algorithm, expiration and subject, then load the user and reject inactive users. Do not accept client-supplied roles as proof of permission.
2. Add centralized role/permission middleware. The initial `admin` role can access all admin routes.
3. Mount both middlewares before **all** `/api/v1/admin/*` routes, including revisions and passkey management. Authentication endpoints have only their intended public exceptions.
4. Return 401 for a missing/invalid session and 403 for an authenticated user without permission. Public page endpoints remain unauthenticated and must still return published content only.
5. Protect any admin preview endpoint too. An unguessable preview URL is not authentication.

## 6. Register a passkey

Use a maintained WebAuthn implementation rather than writing cryptography yourself, for example `@simplewebauthn/server` in the API and `@simplewebauthn/browser` in the Angular admin. Follow the documentation for the exact versions you install; library APIs and response types vary by version.

1. Require an authenticated administrator, and require **recent reauthentication** (password or an existing passkey) before adding/removing a credential. Do not permit a stolen old access token alone to add a passkey.
2. `POST /api/v1/admin/passkeys/register/options`: generate registration options for the current user's stable ID, configured RP ID, and a fresh random challenge. Require user verification, exclude existing credentials, and bind the challenge to this user's authenticated browser flow with a short expiry.
3. In the admin browser, call the WebAuthn registration helper with those options. Let the browser/OS show the passkey prompt.
4. `POST /api/v1/admin/passkeys/register/verify`: verify the browser response with the library against the **stored challenge**, exact expected origin and RP ID, and required user verification. Consume the challenge atomically and only once, including on failure. Reject expired, replayed, wrong-user, wrong-origin and wrong-RP responses.
5. On successful verification, persist the credential ID, public key, counter and metadata under the authenticated user. Reject duplicate credential IDs. Return safe metadata only.

## 7. Sign in with a passkey

1. `POST /api/v1/auth/passkey/options`: accept the email, look up eligible credentials for the active account and create a fresh, short-lived, single-use authentication challenge bound to this browser flow and user. Return only appropriate public options. Avoid account enumeration in errors and responses as far as practical.
2. The browser calls the library's authentication helper and submits the response to `POST /api/v1/auth/passkey/verify`.
3. Look up the credential by ID and verify ownership, challenge, exact origin, RP ID, signature, user verification and applicable counter rules with the library. Atomically consume the challenge and update credential counter/metadata using the library's verified result. Handle synced/backup passkeys according to the library's counter guidance; don't invent a universal monotonic-counter rule.
4. On success, create the **same** access/refresh session as password login. Use generic failures, rate limits and server-side audit logs without logging challenges, raw tokens, passwords or private data.
5. Provide an authenticated page to list credential names/creation dates and revoke a credential after recent reauthentication. Keep password fallback available.

## 8. Minimal Angular admin UI

- Build a login screen with email, password sign-in, and **Sign in with passkey**. Explain browser cancellation/unsupported-device errors without exposing sensitive server details.
- Add a passkey settings screen: register, list and revoke passkeys. Handle a cancelled registration gracefully.
- Add an auth service/interceptor for access tokens and one coordinated refresh attempt; don't create an infinite refresh loop. An admin route guard improves UX but is **not** a substitute for backend authorization.
- Ensure logout clears client state as well as revoking the server session. Do not embed secrets in the Angular bundle.

## 9. Verify before exposing anything

Automate focused API tests and manually exercise the browser/device prompt:

- Password login succeeds; bad credentials, inactive users and rate-limited attempts fail. Admin routes reject missing/invalid/expired tokens; public published routes remain accessible.
- Register a passkey while authenticated, log out, and log in with it. Password fallback still works. A deleted credential cannot sign in.
- Reject expired/replayed challenges, incorrect origin/RP ID, invalid signatures, missing user verification, and credentials belonging to a different user. Test both registration and login.
- Refresh rotation invalidates the old token; logout and password reset revoke sessions. CSRF/origin checks reject cross-origin cookie requests.
- Attempt to access draft pages and preview endpoints without authorization; they must not return draft content.
- Test local HTTPS/localhost as appropriate and verify all cookie flags in a browser. Production requires HTTPS, backups, rate limiting, secret management, and a security review before launch.

## Done when

- [ ] All admin routes are protected by backend authentication and role checks.
- [ ] Administrator can sign in and log out using a password or a registered passkey.
- [ ] Passkey registration, sign-in and revocation work with verified, expiring, single-use challenges.
- [ ] Refresh tokens rotate and revoke; browser cookies and CSRF controls are configured for the chosen origins.
- [ ] Lost-access recovery is documented; the full self-service password-reset requirement is tracked for later.
- [ ] The focused tests above pass. No secrets, raw tokens, passwords, or unpublished data are exposed.

**Do not expose Task 4's admin API until this task is complete.** The full original specification still includes additional production features, including self-service password reset and production hardening.
