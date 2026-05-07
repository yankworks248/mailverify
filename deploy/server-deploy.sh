#!/usr/bin/env bash
set -euo pipefail

G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; B='\033[0;36m'; D='\033[2m'; N='\033[0m'
step()  { echo -e "\n${B}══ $* ══${N}"; }
ok()    { echo -e "  ${G}✓${N} $*"; }
warn()  { echo -e "  ${Y}⚠${N} $*"; }
die()   { echo -e "\n${R}✗ FAILED:${N} $*\n" >&2; exit 1; }
info()  { echo -e "  ${D}$*${N}"; }

ZIP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
[[ -f "$ZIP_DIR/package.json" && -d "$ZIP_DIR/backend" && -d "$ZIP_DIR/frontend" ]] \
  || die "Run from inside the unzipped mailverify/deploy/ directory"

[[ $EUID -eq 0 ]] || die "Must run as root (writes to /opt/, runs docker)"

step "Pre-flight"

[[ -d /opt/email-verifier ]]                    || die "/opt/email-verifier not found"
[[ -f /opt/email-verifier/docker-compose.yml ]] || die "/opt/email-verifier/docker-compose.yml missing"
[[ -f /opt/email-verifier/.env ]]               || die "/opt/email-verifier/.env missing"
ok "/opt/email-verifier/ stack files present"

docker ps --format '{{.Names}}' | grep -q '^verifier-postgres$' || die "verifier-postgres container not running"
docker ps --format '{{.Names}}' | grep -q '^verifier-reacher$'  || die "verifier-reacher container not running"
ok "Postgres + Reacher containers running"

PGUSER_VAL=$(grep -E '^POSTGRES_USER='     /opt/email-verifier/.env | cut -d= -f2-)
PGPASS_VAL=$(grep -E '^POSTGRES_PASSWORD=' /opt/email-verifier/.env | cut -d= -f2-)
PGDB_VAL=$(  grep -E '^POSTGRES_DB='       /opt/email-verifier/.env | cut -d= -f2-)
[[ -n "$PGUSER_VAL" && -n "$PGPASS_VAL" && -n "$PGDB_VAL" ]] || die "Could not read POSTGRES_* from .env"
ok "DB credentials loaded"

HTTP=$(curl -s -o /tmp/reacher.test -w "%{http_code}" --max-time 35 \
  -X POST http://127.0.0.1:8080/v0/check_email \
  -H 'Content-Type: application/json' \
  -d '{"to_email":"info@hetzner.com","from_email":"verifier@inboxaxis.net","hello_name":"verify1.inboxaxis.net","proxy":{"host":"127.0.0.1","port":11073}}' || echo 000)
[[ "$HTTP" == "200" ]] || die "Reacher health probe failed (HTTP $HTTP)"
ok "Reacher responding (200)"

step "1. Backend code → /opt/email-verifier-backend/"
mkdir -p /opt/email-verifier-backend
rsync -a --delete --exclude='node_modules' --exclude='.env' \
  "$ZIP_DIR/backend/" /opt/email-verifier-backend/
ok "Code synced ($(find /opt/email-verifier-backend -name '*.js' | wc -l) JS files)"

step "2. Drop compose override into /opt/email-verifier/"
cp -f "$ZIP_DIR/deploy/docker-compose.override.yml" /opt/email-verifier/docker-compose.override.yml
ok "Override in place"

step "3. Apply DB schema migration"
docker exec -i verifier-postgres psql -U "$PGUSER_VAL" -d "$PGDB_VAL" >/dev/null <<'SQL'
ALTER TABLE verifications ADD COLUMN IF NOT EXISTS status     TEXT NOT NULL DEFAULT 'done';
ALTER TABLE verifications ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE verifications ADD COLUMN IF NOT EXISTS last_name  TEXT;
CREATE INDEX IF NOT EXISTS idx_verifications_status     ON verifications(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_verifications_bulk_job   ON verifications(bulk_job_id);
CREATE INDEX IF NOT EXISTS idx_verifications_email      ON verifications(email);
CREATE INDEX IF NOT EXISTS idx_bulk_jobs_status         ON bulk_jobs(status);
CREATE INDEX IF NOT EXISTS idx_bulk_jobs_uploaded_at    ON bulk_jobs(uploaded_at DESC);
SQL
ok "Schema migrated (status + first_name + last_name columns)"

step "4. Build + start backend container"
cd /opt/email-verifier
docker compose build backend
docker compose up -d backend
ok "Container started"

info "Waiting 5s for backend to boot..."
sleep 5
docker compose ps backend | tail -1

step "5b. Real probe test (info@hetzner.com)"
ADMIN_USER_VAL=$(grep -E '^ADMIN_USERNAME=' /opt/email-verifier/.env 2>/dev/null | cut -d= -f2-)
ADMIN_PASS_VAL=$(grep -E '^ADMIN_PASSWORD=' /opt/email-verifier/.env 2>/dev/null | cut -d= -f2-)

if [[ -n "$ADMIN_USER_VAL" && -n "$ADMIN_PASS_VAL" ]]; then
  COOKIE_JAR=$(mktemp)
  if curl -fsS -c "$COOKIE_JAR" --max-time 10 -X POST http://127.0.0.1:3000/api/auth/login \
       -H 'Content-Type: application/json' \
       -d "{\"username\":\"$ADMIN_USER_VAL\",\"password\":\"$ADMIN_PASS_VAL\"}" >/dev/null 2>&1; then
    RES=$(curl -fsS -b "$COOKIE_JAR" --max-time 60 -X POST http://127.0.0.1:3000/api/verify/single \
          -H 'Content-Type: application/json' -d '{"email":"info@hetzner.com"}' 2>/dev/null) || true
    rm -f "$COOKIE_JAR"
    if echo "$RES" | grep -q '"verdict"'; then
      echo "$RES" | python3 -m json.tool 2>/dev/null || echo "$RES"
      ok "Real probe returned a verdict"
    else
      warn "Probe test failed — test via UI"
    fi
  else
    rm -f "$COOKIE_JAR"
    warn "Login failed during smoke test — test via UI"
  fi
else
  warn "ADMIN_USERNAME/PASSWORD not in .env — skipping probe test"
fi

step "6. Build + serve frontend at /opt/email-verifier-frontend/"
mkdir -p /opt/email-verifier-frontend
rsync -a --delete --exclude='node_modules' --exclude='.next' --exclude='.env.local' \
  "$ZIP_DIR/frontend/" /opt/email-verifier-frontend/

cd /opt/email-verifier-frontend
echo "BACKEND_URL=http://127.0.0.1:3000" > .env.local

if ! command -v node >/dev/null 2>&1; then
  warn "Node.js not found — installing v20 via nodesource..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
NODE_VER=$(node -v | cut -d. -f1 | tr -d v)
[[ "$NODE_VER" -ge 20 ]] || die "Node $NODE_VER too old, need 20+"
ok "Node $(node -v)"

info "Installing frontend deps (this takes a minute)..."
npm install --silent --no-fund --no-audit
info "Building Next.js production bundle..."
npm run build
ok "Frontend built"

if ! command -v pm2 >/dev/null 2>&1; then
  info "Installing PM2 globally..."
  npm install -g pm2 --silent
fi

cd /opt/email-verifier-frontend
pm2 delete verifier-frontend >/dev/null 2>&1 || true
BACKEND_URL=http://127.0.0.1:3000 pm2 start "npm start" --name verifier-frontend --update-env >/dev/null
pm2 save >/dev/null
ok "Frontend running via PM2 on 127.0.0.1:3001"

sleep 2
curl -fsS --max-time 5 -o /dev/null http://127.0.0.1:3001 && ok "Frontend serving 200" || warn "Frontend not yet responding — check pm2 logs verifier-frontend"

PUBLIC_IP=$(curl -fsS --max-time 5 ifconfig.me 2>/dev/null || echo '<server-ip>')

step "Done"
cat <<EOF

Backend:   http://127.0.0.1:3000   ${G}● running${N} (real Reacher, real IPs)
Frontend:  http://127.0.0.1:3001   ${G}● running${N}

Test the UI in your browser via SSH tunnel:

  ssh -L 3001:127.0.0.1:3001 root@${PUBLIC_IP}
  → open http://localhost:3001

Then for production:
  1. Cloudflare DNS:  A  verify.inboxaxis.net  →  ${PUBLIC_IP}  (gray cloud)
  2. Mailcow nginx:   add server block (deploy/DEPLOY.md step 6)
  3. Reload Mailcow:  cd /opt/mailcow-dockerized && docker compose restart nginx-mailcow

Logs:
  Backend:   docker compose -f /opt/email-verifier/docker-compose.yml logs -f backend
  Frontend:  pm2 logs verifier-frontend
  IP usage:  docker exec verifier-postgres psql -U $PGUSER_VAL -d $PGDB_VAL -c "SELECT host(ip), used_today FROM ip_pool ORDER BY ip;"

EOF
