# DigitalOcean deployment

This deployment uses:

- `example.com` for the public SSR website;
- `admin.example.com` for the Angular editor;
- Caddy for automatic HTTPS and reverse proxying;
- a managed/external MongoDB database.

Use an external MongoDB service for a 1 GB droplet. Running MongoDB on the same droplet is not recommended: the API, SSR site, Caddy, and database can exhaust memory under normal load.

## 1. Configure DNS

Create `A` records for both `example.com` and `admin.example.com` pointing to the droplet IPv4 address. Caddy cannot issue certificates until both records resolve publicly.

## 2. Prepare the droplet

Install Docker Engine and the Compose plugin, clone this repository, then create the deployment environment file:

```bash
cp .env.production.example .env.production
chmod 600 .env.production
```

Set every value in `.env.production`. Generate the JWT secret on the droplet:

```bash
openssl rand -hex 48
```

Set `WEBAUTHN_RP_ID` to the registrable domain only (for example `example.com`), not `admin.example.com`. Passkeys require the exact `ADMIN_ORIGIN` and HTTPS.

Allow only SSH, HTTP, and HTTPS in the DigitalOcean cloud firewall: TCP `22`, `80`, and `443`. Do not expose port `6969` or `4000`.

## 3. Start the stack

```bash
docker compose --env-file .env.production -f compose.production.yaml up -d --build
docker compose --env-file .env.production -f compose.production.yaml ps
docker compose --env-file .env.production -f compose.production.yaml logs -f
```

After Caddy receives certificates, visit `https://admin.example.com`, create the first account, and run the starter seed:

```bash
docker compose --env-file .env.production -f compose.production.yaml exec api node dist/scripts/seed.js
```

## 4. Update later

```bash
git pull
docker compose --env-file .env.production -f compose.production.yaml up -d --build
docker image prune -f
```

The public and admin browser apps call `/api/v1` on their own origin. Caddy routes those requests to the private API container, while the SSR container calls `http://api:6969` directly.
