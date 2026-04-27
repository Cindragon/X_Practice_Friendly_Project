import mongoose from "mongoose";

/**
 * Mongoose connection singleton (HMR-safe).
 *
 * Caches both the resolved connection and the in-flight promise on
 * `globalThis`, so concurrent requests during a cold start share one promise.
 */
type MongoCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongo = globalThis as unknown as {
  mongoose?: MongoCache;
};

const cached: MongoCache =
  globalForMongo.mongoose ?? { conn: null, promise: null };

if (!globalForMongo.mongoose) {
  globalForMongo.mongoose = cached;
}

export async function connectMongo(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      // Pull a sane default DB name even if the URI omits it.
      dbName: "friendly",
      bufferCommands: false,
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
