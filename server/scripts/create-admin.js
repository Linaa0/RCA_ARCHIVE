const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config();

const bcrypt = require("bcryptjs");
const { connectToMongo, getUsersCollection, closeDb } = require("../src/models");

async function main() {
  try {
    const email =
      process.env.ADMIN_BOOTSTRAP_EMAIL ||
      process.env.ADMIN_EMAIL ||
      process.argv[2];
    const password =
      process.env.ADMIN_BOOTSTRAP_PASSWORD ||
      process.env.ADMIN_PASSWORD ||
      process.argv[3];
    const name =
      process.env.ADMIN_BOOTSTRAP_NAME ||
      process.env.ADMIN_NAME ||
      process.argv[4] ||
      "Administrator";

    if (!email || !password) {
      console.error(
        "❌ Missing admin credentials! Please set ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD in server/.env, or pass as arguments: node scripts/create-admin.js <email> <password> [name]"
      );
      process.exit(1);
    }

    await connectToMongo();
    const users = getUsersCollection();
    const normalizedEmail = email.toLowerCase().trim();

    let user = await users.findOne({ email: normalizedEmail });

    const hashedPassword = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();

    if (!user) {
      const newUser = {
        id: String(Date.now()),
        username: name.split(" ")[0] || "Admin",
        name,
        email: normalizedEmail,
        password: hashedPassword,
        role: "admin",
        status: "active",
        createdAt: now,
        updatedAt: now,
      };

      await users.insertOne(newUser);
      console.log(`✅ Admin user "${normalizedEmail}" created successfully!`);
    } else {
      await users.updateOne(
        { email: normalizedEmail },
        {
          $set: {
            role: "admin",
            status: "active",
            password: hashedPassword,
            updatedAt: now,
          },
        }
      );
      console.log(
        `✅ User "${normalizedEmail}" updated to admin role and password updated!`
      );
    }

    await closeDb();
    process.exit(0);
  } catch (err) {
    console.error("❌ Error in create-admin:", err);
    process.exit(1);
  }
}

main();
