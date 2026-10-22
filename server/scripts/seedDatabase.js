// This legacy seed script is superseded by scripts/reset-db.js.
// Use "npm run reset:db" or "node scripts/reset-db.js --confirm" to safely reset and seed.
const { resetDb } = require("./reset-db");

if (require.main === module) {
  resetDb().catch((err) => {
    console.error("[ERROR] Seeding failed:", err.message);
    process.exit(1);
  });
}

module.exports = { seedDatabase: resetDb };
