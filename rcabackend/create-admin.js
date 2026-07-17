const bcrypt = require("bcryptjs");
const { connectToMongo, getUsersCollection } = require("./db");

async function main() {
  try {
    await connectToMongo();
    const users = getUsersCollection();
    const email = "mucyoasifiwe80@gmail.com";
    const password = "contac16";
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user exists
    let user = await users.findOne({ email: normalizedEmail });

    if (!user) {
      // Create user
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = {
        id: String(Date.now()),
        username: "Mucyo",
        name: "Mucyo Asifiwe",
        email: normalizedEmail,
        password: hashedPassword,
        role: "admin",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await users.insertOne(newUser);
      console.log("✅ User created and set as admin!");
    } else {
      // Update user to be admin
      await users.updateOne(
        { email: normalizedEmail },
        {
          $set: {
            role: "admin",
            status: "active",
            updatedAt: new Date().toISOString(),
          },
        }
      );

      // Update password if needed
      const hashedPassword = await bcrypt.hash(password, 10);
      await users.updateOne(
        { email: normalizedEmail },
        {
          $set: {
            password: hashedPassword,
            updatedAt: new Date().toISOString(),
          },
        }
      );
      console.log("✅ User updated to admin and password set!");
    }

    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

main();