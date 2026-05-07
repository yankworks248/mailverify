# mailverify

Backend (Node.js/Express) + Frontend (Next.js) + Postgres email verification stack.

Local me **mock mode** chalega — bina real Reacher ke. Server pe deploy karte time real probes on.

## Local setup

Prerequisites: Node 20+, Docker, npm.

```bash
npm install
npm run db:up
npm run dev
```

Open: **http://localhost:3001**

## Server deploy

```bash
scp mailverify.zip root@<server>:/tmp/
ssh root@<server>
cd /tmp && unzip -o mailverify.zip && cd mailverify
bash deploy/server-deploy.sh
```

Then SSH tunnel to test the UI:

```bash
ssh -L 3001:127.0.0.1:3001 root@<server>
# open http://localhost:3001
```

Production checklist (after server deploy works):
1. Cloudflare A record: `verify.inboxaxis.net → <server-ip>`
2. Mailcow nginx server block (see `deploy/DEPLOY.md`)
3. Restart Mailcow nginx

## Project structure

```
mailverify/
├── package.json              workspace root
├── docker-compose.dev.yml    local Postgres
├── postgres/init.sql         schema + IP seeds
├── sample-emails.csv
│
├── backend/                  Express API + bulk worker + cron
│   ├── package.json
│   ├── Dockerfile
│   ├── .env                  local config (mock mode on)
│   └── src/
│       ├── index.js
│       ├── db/index.js
│       ├── services/         ipPool, preFilter, reacher, verifier, csvParser, bulkProcessor
│       ├── api/              verify, jobs, health
│       └── cron/dailyReset.js
│
├── frontend/                 Next.js 14 App Router + Tailwind
│   ├── package.json
│   ├── next.config.mjs
│   └── src/
│       ├── app/              layout, page, globals.css
│       ├── components/       SingleVerify, BulkUpload, StatsBar, JobsList, JobDetail, DonutChart
│       └── lib/api.js
│
└── deploy/
    ├── docker-compose.override.yml
    ├── server-deploy.sh
    └── DEPLOY.md
```

## API

| Method | Path | Purpose |
|--------|------|---------|
| GET    | `/api/health`                 | DB ping + IP pool snapshot + mock flag |
| POST   | `/api/verify/single`          | `{email}` → instant verdict |
| POST   | `/api/verify/bulk/peek`       | multipart `file` → headers + auto-detected columns |
| POST   | `/api/verify/bulk`            | multipart `file` + `column_email` (+ optional `column_first_name`, `column_last_name`) |
| GET    | `/api/jobs?limit=20`          | Recent jobs |
| GET    | `/api/jobs/:uuid`             | One job + counts |
| GET    | `/api/jobs/:uuid/results`     | Per-row results JSON |
| GET    | `/api/jobs/:uuid/results.csv` | CSV download (first_name, last_name, email, verdict, reason, ip, time) |
