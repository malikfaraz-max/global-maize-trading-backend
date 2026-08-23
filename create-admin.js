// Run once to create (or reset) the admin login:
//   node create-admin.js <username> <password>
// Example:
//   node create-admin.js faraz "a-strong-password-here"

const bcrypt = require("bcryptjs");
const db = require("./db");

const [, , username, password] = process.argv;

if (!username || !password) {
  console.error("Usage: node create-admin.js <username> <password>");
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);

db.prepare(
  `INSERT INTO admin_users (username, password_hash) VALUES (?, ?)
   ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash`
).run(username, hash);

console.log(`Admin user "${username}" created/updated.`);
