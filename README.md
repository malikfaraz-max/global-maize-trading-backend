# Global Maize Trading — Backend

A small API that stores every quote request in a real database, plus a
password-protected admin dashboard to manage them.

## What this replaces

Your quote form currently posts to Formspree. Once this is deployed and
the frontend is updated, it will post here instead — every submission
becomes a permanent row you can see, search, and update the status of.

## Local test run

```
npm install
cp .env.example .env      # then edit .env with a real JWT_SECRET
npm run create-admin -- yourusername "a-strong-password"
npm start
```

Visit http://localhost:4000/admin and log in with the username/password
you just created. Test the quote API with:

```
curl -X POST http://localhost:4000/api/quotes -H "Content-Type: application/json" -d '{
  "name":"Test Buyer","email":"test@example.com","phone":"+923001234567",
  "quantity_tons":600,"destination_country":"Netherlands"
}'
```

## Deploying (Render — free tier works for this)

1. Push this `backend` folder to its own GitHub repo (separate from the
   website repo).
2. On render.com, create a new **Web Service**, connect that repo.
3. Build command: `npm install`. Start command: `npm start`.
4. Add environment variables in Render's dashboard: `JWT_SECRET`,
   `ALLOWED_ORIGINS` (your real domain + your `*.github.io` URL).
5. **Important — SQLite persistence:** Render's free web services have
   an ephemeral disk, meaning `data.sqlite` is wiped on every redeploy
   or restart. For a real launch, either:
   - add a Render **persistent disk** (small paid add-on, mounts a
     folder that survives restarts — point `db.js` at that folder), or
   - migrate to a hosted Postgres database once you're past testing
     (Render has a free Postgres tier with an expiry — ask me when
     you're ready and I'll adapt `db.js` to use it instead of SQLite).
6. Once deployed, run the admin-creation command once against the live
   server (Render's dashboard has a "Shell" tab for this), then log in
   at `https://your-backend.onrender.com/admin`.

## Connecting the website to this backend

The quote form on the main site needs its submit handler pointed at
`https://your-backend.onrender.com/api/quotes` instead of Formspree.
I'll make that change once you tell me your backend's live URL.
