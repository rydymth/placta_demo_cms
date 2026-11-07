# Placta CMS

A small configuration-driven CMS prototype: Angular admin, Angular server-rendered website, Express API, MongoDB, and shared page contracts/renderer.

## Status and safety

This is an **unverified development prototype**, not a production-ready CMS. Do not expose the API or admin publicly without a security review and end-to-end verification of authentication, passkeys, publishing, and SSR. Tests/builds have not been run for this implementation. The lockfile must be updated after installing dependencies.

Implemented in the prototype: password login, passkey registration/login/revocation, short-lived access tokens and rotating refresh sessions, a page editor for hero and text sections, draft save, shared preview, publication snapshots/revisions, unpublishing, and a public SSR page route.

Not yet implemented: image uploads and media library, the other component types from the full spec, style/animation/responsive controls, undo/redo, site settings/navigation/footer management, email password reset, and production deployment, backups, accessibility/performance validation and monitoring. Publishing currently writes the revision and the page in separate MongoDB operations: a crash can leave an orphan revision, so this is not yet a transactional publishing solution.

## Local setup

1. Install the root workspace dependencies with `npm install`. This updates `package-lock.json`; commit that update if appropriate. Use the supported Node version for the Angular version in this repository.
2. Copy the root `.env.example` to `apps/api/.env`, or update your existing API `.env`. Never commit `.env` or paste real credentials into source control. Set `MONGODB_URI` to your own MongoDB connection (or your already-established SSH tunnel) and set `JWT_ACCESS_SECRET` to a unique cryptographically random secret at least 32 characters long. No password, secret, or tunnel configuration is included here.
3. For the default setup use `PORT=6969`, `API_HOST=localhost`, `ADMIN_ORIGIN=http://localhost:4201`, `PUBLIC_ORIGIN=http://localhost:4200`, and `WEBAUTHN_RP_ID=localhost`. Use the same `localhost` hostname in your browser: passkeys are tied to the hostname and exact admin origin. If your API runs on a different port, update both `API` constants in `apps/admin/src/app/api.service.ts` and `apps/website/src/app/public-page.ts` to match.
4. From the repository root, run `npm run build:contracts` before starting the API or Angular apps. Rebuild the contracts after changing their source.
5. Create the first administrator once with `npm run create-admin -w @placta/api`. The script prompts interactively for email, display name, and password and will not print the password. If necessary, `npm run reset-password -w @placta/api` is a server-side recovery command; it revokes refresh sessions.
6. In separate terminals run `npm run dev:api`, `npm run dev:admin`, and `npm run dev:website` from the root. The defaults are API `http://localhost:6969`, admin `http://localhost:4201`, and website `http://localhost:4200`.
7. Sign in to the admin with the password, create or open a page, save and publish it, then open its website URL. Add a passkey from the admin's Passkeys section after confirming your password. Sign out and choose passkey sign-in to use it. A passkey registered on `localhost` will not work on a different production hostname.

The API uses the page's **published snapshot slug** for the public route. The homepage slug is `/`; the API represents it as `GET /api/v1/public/pages?slug=%2F`. Saving draft edits must not change the public snapshot.

## Deployment caveats

Public SSR and browser API URLs are development constants, not runtime deployment configuration. Production needs a proper same-origin reverse proxy or independently configured browser/server API endpoints, correct exact WebAuthn origin and RP ID, HTTPS, secure cookies, a secret manager, CORS/CSRF review, robust rate limiting, backups, and monitoring. Do not use the example local MongoDB configuration in production. Review the existing authentication and revision implementation before relying on it; the code has not been exercised end to end.
