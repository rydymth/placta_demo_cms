import mongoose from "mongoose";
import config from "../utils/config.ts";

export async function connectDb(): Promise<void> {
  // handle errors upon error event
  mongoose.connection.on("error", (err) => console.error("MongoDB error: ", err));

  await mongoose.connect(config.mongodbUri, {
    serverSelectionTimeoutMS: 5000
  })
  console.info(`MongoDB connected: ${mongoose.connection.name}`);
}


export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
