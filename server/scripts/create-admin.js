const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config();

const bcrypt = require("bcryptjs");
const { connectToMongo, getUsersCollection, closeDb } = require("../src/models");

async function main() {
  try {
    const email = process.argv[2] || process.env.SEED_ADMIN_EMAIL;
    const password = process.argv[3] || process.env.SEED_ADMIN_PASSWORD;
    const name = process.argv[4] || process.env.SEED_ADMIN_NAME;

    if (!email || !password || !name) {
      console.error(
        "Missing admin credentials. Pass arguments: node scripts/create-admin.js <email> <password> <name> or define SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, and SEED_ADMIN_NAME in server/.env."
      );
      process.exit(1);
    }

    await connectToMongo();
    const users = getUsersCollection();
    const normalizedEmail = email.toLowerCase().trim();

    let user = await users.findOne({ email: normalizedEmail });

    const hashedPassword = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();
    const username = (email.split("@")[0] || "admin").toLowerCase();

    if (!user) {
      const newUser = {
        id: String(Date.now()),
        username,
        name,
        email: normalizedEmail,
        password: hashedPassword,
        role: "admin",
        status: "active",
        createdAt: now,
        updatedAt: now,
      };

      await users.insertOne(newUser);
      console.log(`Admin user "${normalizedEmail}" created successfully.`);
    } else {
      await users.updateOne(
        { email: normalizedEmail },
        {
          $set: {
            name,
            username,
            role: "admin",
            status: "active",
            password: hashedPassword,
            updatedAt: now,
          },
        }
      );
      console.log(
        `User "${normalizedEmail}" updated to admin role and password updated.`
      );
    }

    await closeDb();
    process.exit(0);
  } catch (err) {
    console.error("Error in create-admin:", err);
    process.exit(1);
  }
}

main();
