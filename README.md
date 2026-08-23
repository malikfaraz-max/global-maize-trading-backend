# Global Maize Trading — Backend

Production-ready Express API for quote submissions and an authenticated admin dashboard.

## API

- `GET /` — service status
- `GET /api/health` — backend + SQLite health check
- `POST /api/quotes` — create a quote request
- `POST /api/admin/login` — admin login
- `GET /api/admin/quotes` — authenticated quote list
- `PATCH /api/admin/quotes/:id` — authenticated quote update
- `/admin/` — admin dashboard

## Railway deployment

1. Push this folder to the GitHub repository connected to Railway.
2. Railway should use Node 22.x from `package.json`, `.nvmrc`, and `.node-version`.
3. Set these Railway Variables:
   - `JWT_SECRET` = a long random secret
   - `ALLOWED_ORIGINS` = your real frontend URL(s), comma-separated
   - `NODE_ENV` = `production`
4. Deploy.
5. Test `https://YOUR-RAILWAY-DOMAIN/api/health`.
6. Test `https://YOUR-RAILWAY-DOMAIN/` — it should return JSON instead of `Cannot GET /`.

## Important: SQLite persistence

The current backend uses SQLite. If Railway restarts/redeploys without persistent storage, `data.sqlite` can be lost. For a real production launch, attach a Railway volume and configure the SQLite database path to that persistent mount, or migrate to PostgreSQL. PostgreSQL is the recommended long-term option if the site will receive meaningful production traffic.

## Create the first admin

Run this where the backend's SQLite database is available:

```bash
node create-admin.js admin "CHANGE-THIS-TO-A-STRONG-PASSWORD"
```

Then open:

```text
https://YOUR-RAILWAY-DOMAIN/admin/
```

## Frontend connection

The website's quote form should submit JSON to:

```text
POST https://YOUR-RAILWAY-DOMAIN/api/quotes
```

The frontend must be included in `ALLOWED_ORIGINS`.
