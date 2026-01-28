// התחברות ל־MongoDB
const mongoose = require("mongoose");
const { GridFSBucket } = require("mongodb");

let gfsBucket = null;

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");

    mongoose.connection.once("open", () => {
      gfsBucket = new GridFSBucket(mongoose.connection.db, {
        bucketName: "resources", // זה השם של GridFS (resources.files / resources.chunks)
      });
      console.log("GridFS bucket ready: resources");
    });
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
};

const getGridFSBucket = () => {
  if (!gfsBucket) {
    throw new Error("GridFS not initialized yet");
  }
  return gfsBucket;
};

module.exports = {
  connectDB,
  getGridFSBucket,
};
