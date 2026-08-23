require("dotenv").config();

const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor < 22) {
  console.error(
    `Unsupported Node.js ${process.versions.node}. This backend requires Node.js 22.x.`
  );
  process.exit(1);
}

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("Missing JWT_SECRET in environment. Set it before starting the server.");
  process.exit(1);
}

// ---- Admin bootstrap ----
// Railway can create/update the admin account automatically from environment
// variables. The password is hashed and never stored as plain text.
const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || "").trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

if (ADMIN_USERNAME || ADMIN_PASSWORD) {
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    console.error("ADMIN_USERNAME and ADMIN_PASSWORD must either both be set or both be omitted.");
    process.exit(1);
  }

  const passwordHash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
  db.prepare(
    `INSERT INTO admin_users (username, password_hash) VALUES (?, ?)
     ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash`
  ).run(ADMIN_USERNAME, passwordHash);

  console.log(`Admin account configured from environment: ${ADMIN_USERNAME}`);
}

// ---- CORS ----
// Comma-separated list of origins allowed to call this API, e.g.
// ALLOWED_ORIGINS=https://globalmaizetrading.com,https://yourusername.github.io
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",").map(s => s.trim()).filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Requests without an Origin header (server-to-server, curl, browser navigation) are fine.
    if (!origin) return callback(null, true);

    // The admin dashboard is served by this same backend. Browsers send an Origin
    // header for its POST/PATCH requests, so allow the Railway host automatically.
    // This prevents the admin login from being turned into a 500 by the CORS layer.
    const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : null;
    const railwayOrigin = railwayDomain || null;

    if (allowedOrigins.includes(origin) || (railwayOrigin && origin === railwayOrigin)) {
      return callback(null, true);
    }

    // Also allow the current Railway deployment hostname when Railway exposes it
    // through RAILWAY_PUBLIC_DOMAIN; otherwise reject unknown browser origins.
    callback(new Error("Not allowed by CORS: " + origin));
  }
}));

app.use(express.json({ limit: "100kb" }));

// Simple service-discovery endpoint. The root URL should not return "Cannot GET /".
app.get("/", (req, res) => {
  res.json({ service: "Global Maize Trading API", status: "online", health: "/api/health" });
});

const adminPath = path.join(__dirname, "public", "admin");

// Serve the admin dashboard from disk when the public folder is present.
// If a deployment omitted that folder, fall back to the embedded dashboard so
// /admin/ still works without relying on filesystem layout.
const ADMIN_HTML = "<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n<title>Admin | Global Maize Trading</title>\n<style>\n:root{--navy:#16233a;--wheat:#b9853a;--wheatd:#8a5f22;--paper:#f3ecdb;--card:#fbf8ef;--ink:#221d14;--muted:#726a56;--line:#ddd0b1}\n*{box-sizing:border-box}\nbody{margin:0;font-family:system-ui,sans-serif;background:var(--paper);color:var(--ink)}\n.bar{background:var(--navy);color:#fff;padding:16px 24px;font-weight:700;display:flex;justify-content:space-between;align-items:center}\n.bar button{background:transparent;border:1px solid #ffffff55;color:#fff;padding:8px 14px;border-radius:3px;cursor:pointer}\n.wrap{max-width:1400px;margin:0 auto;padding:24px}\n.login{max-width:340px;margin:80px auto;background:var(--card);border:1px solid var(--line);border-radius:6px;padding:30px}\n.login h1{font-size:18px;margin:0 0 18px}\n.login input{width:100%;padding:11px;margin-bottom:12px;border:1px solid var(--line);border-radius:3px;font-size:14px}\n.login button{width:100%;padding:12px;background:var(--navy);color:#fff;border:0;border-radius:3px;font-weight:700;cursor:pointer}\n.err{color:#a33;font-size:13px;margin-bottom:10px;display:none}\ntable{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);font-size:13px}\nth,td{padding:9px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}\nth{background:#eee4cc;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}\nselect,input.cell{font-size:12.5px;padding:5px;border:1px solid var(--line);border-radius:3px;width:100%}\n.save{background:var(--wheat);border:0;color:#1b1608;padding:6px 10px;border-radius:3px;cursor:pointer;font-weight:700;font-size:11.5px}\n.tag{padding:3px 8px;border-radius:20px;font-size:11px;font-weight:700}\n.muted{color:var(--muted)}\n.loading{padding:60px;text-align:center;color:var(--muted)}\n</style>\n</head>\n<body>\n<div id=\"app\"></div>\n<script>\nconst API = \"\"; // same origin as this page — leave blank when admin is served by the backend itself\nlet token = localStorage.getItem(\"gmt_token\") || null;\n\nfunction el(html){ const d=document.createElement(\"div\"); d.innerHTML=html; return d.firstElementChild; }\n\nasync function login(username, password){\n  const res = await fetch(API + \"/api/admin/login\", {\n    method:\"POST\", headers:{\"Content-Type\":\"application/json\"},\n    body: JSON.stringify({username, password})\n  });\n  const data = await res.json();\n  if(!res.ok) throw new Error(data.error || \"Login failed\");\n  token = data.token;\n  localStorage.setItem(\"gmt_token\", token);\n}\n\nasync function fetchQuotes(){\n  const res = await fetch(API + \"/api/admin/quotes\", { headers:{ Authorization: \"Bearer \" + token } });\n  if(res.status === 401){ logout(); throw new Error(\"Session expired\"); }\n  return res.json();\n}\n\nasync function updateQuote(id, patch){\n  const res = await fetch(API + \"/api/admin/quotes/\" + id, {\n    method:\"PATCH\", headers:{\"Content-Type\":\"application/json\", Authorization:\"Bearer \" + token},\n    body: JSON.stringify(patch)\n  });\n  return res.json();\n}\n\nfunction logout(){ token=null; localStorage.removeItem(\"gmt_token\"); render(); }\n\nconst STATUSES = [\"New\",\"Quoted\",\"Deposit Paid\",\"Confirmed\",\"Shipped\",\"Cancelled\"];\n\nfunction renderLogin(){\n  const app = document.getElementById(\"app\");\n  app.innerHTML = \"\";\n  app.appendChild(el(`\n    <div class=\"login\">\n      <h1>Global Maize Trading — Admin</h1>\n      <div class=\"err\" id=\"err\"></div>\n      <input id=\"u\" placeholder=\"Username\" autocomplete=\"username\">\n      <input id=\"p\" placeholder=\"Password\" type=\"password\" autocomplete=\"current-password\">\n      <button id=\"go\">Log in</button>\n    </div>\n  `));\n  document.getElementById(\"go\").onclick = async () => {\n    const err = document.getElementById(\"err\");\n    err.style.display = \"none\";\n    try {\n      await login(document.getElementById(\"u\").value, document.getElementById(\"p\").value);\n      render();\n    } catch(e){ err.textContent = e.message; err.style.display = \"block\"; }\n  };\n}\n\nasync function renderDashboard(){\n  const app = document.getElementById(\"app\");\n  app.innerHTML = `<div class=\"bar\"><span>Global Maize Trading — Quotes</span><button id=\"logout\">Log out</button></div><div class=\"wrap\"><div class=\"loading\">Loading...</div></div>`;\n  document.getElementById(\"logout\").onclick = logout;\n\n  let rows;\n  try { rows = await fetchQuotes(); } catch(e){ return; }\n\n  const wrap = document.querySelector(\".wrap\");\n  if(!rows.length){ wrap.innerHTML = \"<p class='muted'>No quote requests yet.</p>\"; return; }\n\n  wrap.innerHTML = `<table><thead><tr>\n    <th>Date</th><th>Name / Company</th><th>Contact</th><th>Qty (t)</th><th>Country</th><th>Port</th>\n    <th>Delivery date</th><th>Requirements</th><th>Status</th><th>Deposit</th><th>Notes</th><th></th>\n  </tr></thead><tbody></tbody></table>`;\n  const tbody = wrap.querySelector(\"tbody\");\n\n  rows.forEach(r => {\n    const tr = el(`<tr>\n      <td class=\"muted\">${new Date(r.created_at).toLocaleDateString()}</td>\n      <td>${r.name}</td>\n      <td>${r.email}<br><span class=\"muted\">${r.phone}</span></td>\n      <td>${r.quantity_tons}</td>\n      <td>${r.destination_country}</td>\n      <td>${r.delivery_port_city || \"—\"}</td>\n      <td>${r.delivery_date || \"—\"}</td>\n      <td style=\"max-width:220px\">${(r.requirements || \"—\")}</td>\n      <td><select class=\"st\">${STATUSES.map(s => `<option ${s===r.status?\"selected\":\"\"}>${s}</option>`).join(\"\")}</select></td>\n      <td><input class=\"cell dep\" value=\"${r.deposit_amount || \"\"}\" placeholder=\"e.g. 25000\"></td>\n      <td><input class=\"cell notes\" value=\"${r.admin_notes || \"\"}\" placeholder=\"internal note\"></td>\n      <td><button class=\"save\">Save</button></td>\n    </tr>`);\n    tr.querySelector(\".save\").onclick = async () => {\n      const status = tr.querySelector(\".st\").value;\n      const deposit_amount = tr.querySelector(\".dep\").value;\n      const admin_notes = tr.querySelector(\".notes\").value;\n      await updateQuote(r.id, { status, deposit_amount, admin_notes });\n      tr.querySelector(\".save\").textContent = \"Saved\";\n      setTimeout(() => tr.querySelector(\".save\").textContent = \"Save\", 1200);\n    };\n    tbody.appendChild(tr);\n  });\n}\n\nfunction render(){ token ? renderDashboard() : renderLogin(); }\nrender();\n</script>\n</body>\n</html>\n";

app.use("/admin", express.static(adminPath));
app.get(["/admin", "/admin/"], (req, res) => {
  const adminFile = path.join(adminPath, "index.html");
  res.sendFile(adminFile, (err) => {
    if (err) {
      console.warn("Admin file not found; serving embedded dashboard:", err.code || err.message);
      res.type("html").send(ADMIN_HTML);
    }
  });
});

// ---- Public: submit a quote request ----
const VALID_STATUSES = ["New", "Quoted", "Deposit Paid", "Confirmed", "Shipped", "Cancelled"];

app.post("/api/quotes", (req, res) => {
  const {
    name, email, phone, quantity_tons, destination_country,
    delivery_port_city, product, delivery_date, requirements
  } = req.body || {};

  if (!name || !email || !phone || !quantity_tons || !destination_country) {
    return res.status(400).json({ error: "Missing required fields." });
  }
  const qty = Number(quantity_tons);
  if (!Number.isFinite(qty) || qty < 500 || qty > 5000) {
    return res.status(400).json({ error: "Quantity must be between 500 and 5000 tons." });
  }

  const stmt = db.prepare(`
    INSERT INTO quotes (name, email, phone, quantity_tons, destination_country,
      delivery_port_city, product, delivery_date, requirements)
    VALUES (@name, @email, @phone, @quantity_tons, @destination_country,
      @delivery_port_city, @product, @delivery_date, @requirements)
  `);
  const info = stmt.run({
    name, email, phone, quantity_tons: qty, destination_country,
    delivery_port_city: delivery_port_city || null,
    product: product || "Premium Yellow Maize",
    delivery_date: delivery_date || null,
    requirements: requirements || null
  });

  res.status(201).json({ ok: true, id: info.lastInsertRowid });
});

// ---- Admin auth ----
app.post("/api/admin/login", (req, res) => {
  try {
    const { username, password } = req.body || {};
    const user = db.prepare("SELECT * FROM admin_users WHERE username = ?").get(username || "");
    if (!user || !bcrypt.compareSync(password || "", user.password_hash)) {
      return res.status(401).json({ error: "Invalid username or password." });
    }
    const token = jwt.sign({ sub: user.id, username: user.username }, JWT_SECRET, { expiresIn: "12h" });
    res.json({ token });
  } catch (err) {
    console.error("Admin login failed:", err);
    res.status(500).json({ error: "Admin login failed on the server." });
  }
});

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token." });
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token." });
  }
}

// ---- Admin: list + update quotes ----
app.get("/api/admin/quotes", requireAuth, (req, res) => {
  const rows = db.prepare("SELECT * FROM quotes ORDER BY created_at DESC").all();
  res.json(rows);
});

app.patch("/api/admin/quotes/:id", requireAuth, (req, res) => {
  const { status, deposit_amount, admin_notes } = req.body || {};
  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: "Invalid status. Must be one of: " + VALID_STATUSES.join(", ") });
  }
  const existing = db.prepare("SELECT * FROM quotes WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found." });

  db.prepare(`
    UPDATE quotes SET
      status = COALESCE(@status, status),
      deposit_amount = COALESCE(@deposit_amount, deposit_amount),
      admin_notes = COALESCE(@admin_notes, admin_notes)
    WHERE id = @id
  `).run({
    id: req.params.id,
    status: status || null,
    deposit_amount: deposit_amount !== undefined ? String(deposit_amount) : null,
    admin_notes: admin_notes !== undefined ? admin_notes : null
  });

  res.json(db.prepare("SELECT * FROM quotes WHERE id = ?").get(req.params.id));
});
// ---- Chad AI assistant ----
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.post("/api/chad", async (req, res) => {
  try {
    const { message, history } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Message is required."
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY is missing.");
      return res.status(500).json({
        error: "Chad AI is not configured on the server."
      });
    }

    const safeHistory = Array.isArray(history)
      ? history
          .filter(
            x =>
              x &&
              (x.role === "user" || x.role === "assistant") &&
              typeof x.content === "string"
          )
          .slice(-10)
      : [];

    const messages = [
      {
        role: "system",
        content: `
You are Chad, the official AI website assistant for Global Maize Trading.

Company:
- Global Maize Trading
- Based in Multan, Pakistan
- Supplies Pakistan-grown premium yellow maize
- Commercial order size: 500 to 5,000 metric tons
- International wholesale buyers are welcome
- WhatsApp: +92 345 0306973
- Email: malikfarazakramofficial@gmail.com

Your job:
1. Answer questions about Global Maize Trading clearly and professionally.
2. Answer general questions when useful.
3. Never invent prices, freight rates, payment terms, availability, contracts,
   shipment commitments, or other shipment-specific commercial information.
4. For current prices, freight, payment terms or availability, tell the user
   that the trading team must confirm those details.
5. Never claim that a quotation has been submitted unless the website's quote
   form actually submitted it.
6. Keep answers concise and helpful.
7. You are a website assistant, not a financial, legal, or medical advisor.
        `.trim()
      },
      ...safeHistory,
      {
        role: "user",
        content: message.trim()
      }
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.3,
      max_tokens: 500
    });

    const answer =
      completion.choices?.[0]?.message?.content?.trim();

    if (!answer) {
      throw new Error("OpenAI returned an empty response.");
    }

    res.json({
      answer
    });

  } catch (err) {
    console.error("Chad AI error:", err);

    res.status(500).json({
      error: "Chad is temporarily unavailable."
    });
  }
});
app.get("/api/health", (req, res) => {
  try {
    db.prepare("SELECT 1").get();
    res.json({ ok: true, status: "healthy", database: "connected" });
  } catch (err) {
    console.error("Health check failed:", err);
    res.status(503).json({ ok: false, status: "unhealthy", database: "disconnected" });
  }
});

// JSON 404 response for unknown API routes.
app.use("/api", (req, res) => {
  res.status(404).json({ error: "API route not found", path: req.path });
});

// Final error handler so unexpected errors don't crash the process.
app.use((err, req, res, next) => {
  console.error("Unhandled request error:", err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "Internal server error" });
});

const server = app.listen(PORT, () => console.log(`Global Maize Trading backend running on port ${PORT}`));

function shutdown(signal) {
  console.log(`${signal} received. Shutting down gracefully...`);
  server.close(() => {
    try { db.close(); } catch {}
    process.exit(0);
  });
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
