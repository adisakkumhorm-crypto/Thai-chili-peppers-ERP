#!/usr/bin/env bash
# Recreates the two alpine/socat port bridges that connect Traefik to the
# Next.js app and to the dockerized Supabase Kong gateway.
# No secrets involved; these only map ports on the docker bridge host IP.

set -euo pipefail

# App bridge: Traefik -> host Next.js (managed by PM2) on 127.0.0.1:3001
docker run -d --name erp-proxy --restart unless-stopped \
  alpine/socat \
  tcp-listen:3001,fork,reuseaddr tcp:172.17.0.1:3001

# Supabase bridge: Traefik -> host Supabase Kong on 127.0.0.1:54321
docker run -d --name erp-supabase-proxy --restart unless-stopped \
  alpine/socat \
  tcp-listen:54321,fork,reuseaddr tcp:172.17.0.1:54321