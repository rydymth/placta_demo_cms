import { Schema, model } from "mongoose";

const userDbSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "editor"], default: "admin", required: true },
    isActive: { type: Boolean, default: true, required: true },
  },
  { timestamps: true },
);

export const UserModel = model("User", userDbSchema);
