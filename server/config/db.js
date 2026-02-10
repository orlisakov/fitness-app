const mongoose = require("mongoose");

let bucket = null;

// ✅ Cache גלובלי (שורד בין invocations באותו instance)
let cached = global.__MONGO_CACHE__;
if (!cached) {
  cached = global.__MONGO_CACHE__ = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) {
    // ✅ כבר מחובר
    if (!bucket) {
      bucket = new mongoose.mongo.GridFSBucket(cached.conn.connection.db, {
        bucketName: "resources",
      });
    }
    return cached.conn;
  }

  if (!cached.promise) {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error("Missing MONGO_URI env var");

    cached.promise = mongoose.connect(uri, {
      serverSelectionTimeoutMS: 12000,
    });
  }

  try {
    cached.conn = await cached.promise;

    // ✅ init GridFS פעם אחת
    if (!bucket) {
      bucket = new mongoose.mongo.GridFSBucket(cached.conn.connection.db, {
        bucketName: "resources",
      });
    }

    console.log(
      "✅ Mongo connected to:",
      mongoose.connection.host,
      mongoose.connection.name,
    );
    console.log("✅ GridFS ready");

    return cached.conn;
  } catch (err) {
    cached.promise = null; // כדי לא להינעל על promise שנכשל
    console.error("Mongo connection error:", err);
    // ❌ לא עושים process.exit ב-serverless
    throw err;
  }
}

function getGridFSBucket() {
  if (!bucket) throw new Error("GridFS not initialized yet");
  return bucket;
}

module.exports = { connectDB, getGridFSBucket };
