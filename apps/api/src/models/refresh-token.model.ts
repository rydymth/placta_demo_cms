import { Schema, model } from "mongoose";

const refreshTokenDbSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    userAgent: { type: String, default: "" },
  },
  { timestamps: true },
);

// Mongo removes expired sessions on its own.
refreshTokenDbSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshTokenModel = model("RefreshToken", refreshTokenDbSchema);
