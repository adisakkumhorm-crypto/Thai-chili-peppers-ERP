# Thai Chili Peppers ERP — Deployment Config Backup

Sanitized copy of the deployment configuration required to bring the ERP back
online on the VPS (`srv1163162.hstgr.cloud`). No real secrets are stored here.

## Runtime topology

```
Internet / Cloudflare Tunnel (cloudflared)
   └─► Traefik (root-traefik-1, ports 80/443)
         ├─ Host: erp.estimateoohub.cloud (non-`/api` paths)
         │     └─► erp-proxy (socat :3001) ──► host Next.js on 127.0.0.1:3001
         │            (Next.js is managed by PM2 as `skool-erp`)
         └─ Host: erp.estimateoohub.cloud + PathPrefix(/auth/v1, /rest/v1,
               /storage/v1, /realtime/v1, /graphql/v1)
               └─► erp-supabase-proxy (socat :54321) ──► host Supabase Kong :54321
                      (dockerized Supabase stack `thai-chili-peppers-erp`)
```

## Files in this backup

| File | Purpose |
|------|---------|
| `pm2.ecosystem.config.cjs` | PM2 config that keeps the Next.js app alive (runs `npm start` → `next start -p 3001`) |
| `traefik-docker-compose.yml` | Traefik reverse proxy (uses env-var placeholders, no secrets) |
| `socat-proxies.sh` | Commands that recreate the two `alpine/socat` port-bridge containers |
| `../.env.example` | Sanitized environment-variable template (names only, placeholder values) |

## Required environment variables (values live in `.env` on the VPS only)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `N8N_WEBHOOK_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `CRON_SECRET`
- `ANTHROPIC_API_KEY` (optional)
- `ANTHROPIC_MODEL` (optional)
- `SSL_EMAIL` (Traefik ACME)
- `SUBDOMAIN`, `DOMAIN_NAME` (for n8n route on the same Traefik)

## Restore checklist

1. `git clone` this repo on the VPS, `pnpm install`, `pnpm build` (or use a
   prebuilt `.next` if present).
2. `cp .env.example .env` and fill real values from the VPS.
3. Start the app: `pm2 start deployment-backup/pm2.ecosystem.config.cjs`.
4. Start Supabase stack (`supabase start` → containers `supabase_*_thai-chili-peppers-erp`).
5. Create the socat bridges with `deployment-backup/socat-proxies.sh`.
6. Start Traefik with `deployment-backup/traefik-docker-compose.yml`.

## Security

- `.env`, `.env.local`, and every `.env*` file are git-ignored.
- The live `.env` (with real Supabase keys) is **not** stored in git.
- The database dump with user data is **not** stored on GitHub because the
  repository is public. It lives on the VPS only (see backup report).