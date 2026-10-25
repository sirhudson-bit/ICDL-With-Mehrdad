# Deploy — academyr.ir

| What | Where |
| --- | --- |
| Host | `194.56.148.100` (Ubuntu 24.04, root SSH key) |
| App dir | `/var/www/academyr.ir` |
| Port | `3000` (loopback only; nginx proxies to it) |
| Process | pm2 `icdl` (single instance — SQLite allows one writer) |
| Database | `/var/www/academyr.ir/prisma/prod.db` + `prisma/backups/` |
| Env | `/var/www/academyr.ir/.env` (chmod 600, gitignored) |
| nginx | `/etc/nginx/sites-enabled/academyr.ir` |

## First time

```bash
git clone https://github.com/sirhudson-bit/ICDL-With-Mehrdad.git /var/www/academyr.ir
cd /var/www/academyr.ir

# .env  (see .env.example for every key)
NEXT_PUBLIC_SITE_URL="https://academyr.ir"
DATABASE_URL="file:./prod.db"        # relative to prisma/
AUTH_SECRET="$(node -e 'console.log(crypto.randomBytes(48).toString("base64url"))')"

npm ci
npx prisma db push
SEED_ADMIN_PASSWORD='<strong-password>' npm run db:seed   # creates the admin user
npm run build
APP_DIR=/var/www/academyr.ir PORT=3000 pm2 start deploy/ecosystem.config.cjs
pm2 save
```

## Every later deploy

```bash
cd /var/www/academyr.ir && bash deploy/redeploy.sh
```

Pulls `main`, backs up SQLite, `npm ci`, `prisma db push`, `next build`, then
`pm2 startOrReload` (a short restart — not zero-downtime).

## Operations

- Logs: `pm2 logs icdl`
- Restart: `pm2 restart icdl`
- Backups: copy `prisma/prod.db` and `storage/uploads/` (if used) off the box.
- The seeded admin password must not stay at the value in `prisma/seed.ts`.

## Notes

- **One process only.** SQLite is a single-writer database; never switch this
  pm2 app to cluster mode.
- `npm ci` runs with `NODE_ENV` unset, so devDependencies (typescript, tailwind,
  prisma CLI) are installed — `next build` needs them.
- TLS: `certbot --nginx -d academyr.ir`. Add `www.academyr.ir` only after every
  A record for `www` points here; a leftover parking record breaks validation.
