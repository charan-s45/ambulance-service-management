import mongoose from "mongoose";

// Reject query filters with fields not in the schema (helps catch typos).
mongoose.set("strictQuery", true);

export async function connectDB(uri) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  // Make sure unique indexes (email, bookingId, ...) exist before we accept traffic.
  await mongoose.connection.syncIndexes();
  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
}

export async function disconnectDB() {
  await mongoose.disconnect();
}
