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

// ---- CORS ----
// Comma-separated list of origins allowed to call this API, e.g.
// ALLOWED_ORIGINS=https://globalmaizetrading.com,https://yourusername.github.io
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",").map(s => s.trim()).filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // allow same-origin/non-browser requests (no Origin header) and admin dashboard on this server itself
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error("Not allowed by CORS: " + origin));
  }
}));

app.use(express.json());
app.use("/admin", express.static(path.join(__dirname, "public", "admin")));

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
  const { username, password } = req.body || {};
  const user = db.prepare("SELECT * FROM admin_users WHERE username = ?").get(username || "");
  if (!user || !bcrypt.compareSync(password || "", user.password_hash)) {
    return res.status(401).json({ error: "Invalid username or password." });
  }
  const token = jwt.sign({ sub: user.id, username: user.username }, JWT_SECRET, { expiresIn: "12h" });
  res.json({ token });
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

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`Global Maize Trading backend running on port ${PORT}`));
