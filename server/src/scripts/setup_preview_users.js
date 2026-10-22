const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

async function setupUsers() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('rca_past_papers');
  const users = db.collection('users');

  const hashedPassword = await bcrypt.hash('Password123!', 10);

  // Student user
  await users.updateOne(
    { email: 'grace.stanley@rca.ac.rw' },
    { $set: { name: 'Grace Stanley', username: 'Grace Stanley', email: 'grace.stanley@rca.ac.rw', password: hashedPassword, role: 'student', verified: true, active: true, updatedAt: new Date() } },
    { upsert: true }
  );
  console.log('Student user verified: grace.stanley@rca.ac.rw / Password123!');

  // Admin user
  await users.updateOne(
    { email: 'admin@rca.ac.rw' },
    { $set: { name: 'Administrator', username: 'Administrator', email: 'admin@rca.ac.rw', password: hashedPassword, role: 'admin', verified: true, active: true, updatedAt: new Date() } },
    { upsert: true }
  );
  console.log('Admin user verified: admin@rca.ac.rw / Password123!');

  await client.close();
}
setupUsers();
