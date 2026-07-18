require("dotenv").config();
const { MongoClient } = require("mongodb");

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const MONGO_DB_NAME = process.env.MONGO_DB_NAME || "rca_past_papers";

async function checkDB() {
  const client = new MongoClient(MONGO_URI);
  
  try {
    await client.connect();
    console.log("Connected to MongoDB successfully!");

    const db = client.db(MONGO_DB_NAME);

    // Check users collection
    const users = await db.collection("users").find().toArray();
    console.log("\n--- Users Collection ---");
    console.log(`Total users: ${users.length}`);
    users.forEach(user => {
      console.log(`- ${user.username || user.name} (${user.email}) - Role: ${user.role}`);
    });

    // Check papers collection
    const papers = await db.collection("papers").find().toArray();
    console.log("\n--- Papers Collection ---");
    console.log(`Total papers: ${papers.length}`);
    papers.forEach(paper => {
      console.log(`- ${paper.title} (${paper.subject} - Year ${paper.year}) by ${paper.uploadedBy}`);
    });

    // Check deletion requests
    const deletions = await db.collection("deletionRequests").find().toArray();
    console.log("\n--- Deletion Requests Collection ---");
    console.log(`Total requests: ${deletions.length}`);
    deletions.forEach(req => {
      console.log(`- ${req.paperTitle} (Status: ${req.status})`);
    });

  } catch (err) {
    console.error("Error connecting to MongoDB:", err);
  } finally {
    await client.close();
  }
}

checkDB();
