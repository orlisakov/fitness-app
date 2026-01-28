const mongoose = require("mongoose");

let bucket = null;

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);

    bucket = new mongoose.mongo.GridFSBucket(conn.connection.db, {
      bucketName: "resources",
    });

    console.log("MongoDB connected + GridFS ready");
  } catch (err) {
    console.error("Mongo connection error:", err);
    process.exit(1);
  }
};

const getGridFSBucket = () => {
  if (!bucket) {
    throw new Error("GridFS not initialized yet");
  }
  return bucket;
};

module.exports = { connectDB, getGridFSBucket };
