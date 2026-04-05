const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://sai_lasya:sailasya1109@cluster0.otakzhm.mongodb.net/bizmitra?retryWrites=true&w=majority';
const DB_NAME = 'bizmitra';

let db;

async function connectDB() {
  try {
    const client = await MongoClient.connect(MONGO_URI, {
      tls: true,
      tlsAllowInvalidCertificates: false,
    });
    db = client.db(DB_NAME);
    console.log('✅  Connected to MongoDB Atlas successfully!');
  } catch (err) {
    console.error('❌  MongoDB connection failed:', err.message);
    process.exit(1);
  }
}

function getDB() {
  if (!db) {
    throw new Error('Database not connected. Call connectDB() first.');
  }
  return db;
}

module.exports = { connectDB, getDB };
