const Database = require("better-sqlite3");
const path = require("path");

// SQLite file lives alongside the app. On most free hosting tiers the
// filesystem is ephemeral (wiped on redeploy/restart) — see README.md
// for how to attach a persistent disk, or migrate to Postgres later.
const db = new Database(path.join(__dirname, "data.sqlite"));

db.exec(`
CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  quantity_tons INTEGER NOT NULL,
  destination_country TEXT NOT NULL,
  delivery_port_city TEXT,
  product TEXT,
  delivery_date TEXT,
  requirements TEXT,
  status TEXT NOT NULL DEFAULT 'New',
  deposit_amount TEXT,
  admin_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL
);
`);

module.exports = db;
