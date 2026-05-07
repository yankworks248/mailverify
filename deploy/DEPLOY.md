# Production Deploy

## Quick path

```bash
scp mailverify.zip root@<server>:/tmp/
ssh root@<server>
cd /tmp && unzip -o mailverify.zip && cd mailverify
bash deploy/server-deploy.sh
```

The script handles steps 1-6 below automatically. Use the manual steps only if you want to debug or skip parts.

---

## Manual steps (reference)

### 1. Pre-check

```bash
systemctl status danted@73 danted@74 danted@75 danted@76 danted@77 danted@78
cd /opt/email-verifier && docker compose ps
curl -s http://127.0.0.1:8080/v0/check_email -X POST \
  -H "Content-Type: application/json" \
  -d '{"to_email":"info@hetzner.com","from_email":"verifier@inboxaxis.net",
       "hello_name":"verify1.inboxaxis.net","proxy":{"host":"127.0.0.1","port":11073}}'
```

### 2. Copy backend

```bash
mkdir -p /opt/email-verifier-backend
rsync -a --delete /tmp/mailverify/backend/ /opt/email-verifier-backend/
```

### 3. DB schema migration

```bash
docker exec -i verifier-postgres psql -U verifier -d verifier <<'SQL'
ALTER TABLE verifications ADD COLUMN IF NOT EXISTS status     TEXT NOT NULL DEFAULT 'done';
ALTER TABLE verifications ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE verifications ADD COLUMN IF NOT EXISTS last_name  TEXT;
CREATE INDEX IF NOT EXISTS idx_verifications_status     ON verifications(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_verifications_bulk_job   ON verifications(bulk_job_id);
CREATE INDEX IF NOT EXISTS idx_verifications_email      ON verifications(email);
CREATE INDEX IF NOT EXISTS idx_bulk_jobs_status         ON bulk_jobs(status);
CREATE INDEX IF NOT EXISTS idx_bulk_jobs_uploaded_at    ON bulk_jobs(uploaded_at DESC);
SQL
```

### 4. Compose override + start backend

```bash
cp /tmp/mailverify/deploy/docker-compose.override.yml /opt/email-verifier/
cd /opt/email-verifier
docker compose build backend
docker compose up -d backend
docker compose logs backend --tail 30
```

### 5. Backend smoke tests

```bash
curl -s http://127.0.0.1:3000/api/health | jq '.mockMode, .capacity'
curl -s -X POST http://127.0.0.1:3000/api/verify/single \
  -H "Content-Type: application/json" \
  -d '{"email":"info@hetzner.com"}' | jq '.'
docker exec verifier-postgres psql -U verifier -d verifier \
  -c "SELECT host(ip), used_today FROM ip_pool ORDER BY ip;"
```

### 6. Frontend (build + PM2)

```bash
mkdir -p /opt/email-verifier-frontend
rsync -a --delete /tmp/mailverify/frontend/ /opt/email-verifier-frontend/
cd /opt/email-verifier-frontend
echo "BACKEND_URL=http://127.0.0.1:3000" > .env.local
npm install
npm run build
npm install -g pm2
pm2 delete verifier-frontend 2>/dev/null || true
BACKEND_URL=http://127.0.0.1:3000 pm2 start "npm start" --name verifier-frontend --update-env
pm2 save && pm2 startup
```

### 7. Cloudflare DNS + Mailcow nginx

Cloudflare: A record `verify.inboxaxis.net → <server-ip>`, gray cloud (DNS-only).

Mailcow nginx config:

```bash
cat > /opt/mailcow-dockerized/data/conf/nginx/verify.conf <<'NGINX'
server {
  listen 443 ssl http2;
  server_name verify.inboxaxis.net;
  ssl_certificate     /etc/ssl/mail/cert.pem;
  ssl_certificate_key /etc/ssl/mail/key.pem;
  client_max_body_size 60M;
  location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For  $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
NGINX
cd /opt/mailcow-dockerized
docker compose restart nginx-mailcow
```

LE cert kuch minutes me Mailcow ke acme container se auto-issue ho jayega.

---

## Operations

```bash
docker compose -f /opt/email-verifier/docker-compose.yml logs -f backend
pm2 logs verifier-frontend

docker exec verifier-postgres psql -U verifier -d verifier \
  -c "UPDATE ip_pool SET used_today = 0, last_reset_at = NOW();"

docker exec verifier-postgres psql -U verifier -d verifier \
  -c "UPDATE ip_pool SET status = 'paused' WHERE host(ip) = '135.181.11.74';"

docker exec verifier-postgres psql -U verifier -d verifier \
  -c "SELECT status, count(*) FROM verifications GROUP BY status;"
```
