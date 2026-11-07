import { Schema, model } from "mongoose";

const authChallengeDbSchema = new Schema({
  flowId: { type: String, required: true, unique: true },
  type: { type: String, enum: ["register", "login"], required: true },
  challenge: { type: String, required: true },
  userId: { type: Schema.Types.ObjectId, default: null },
  expiresAt: { type: Date, required: true },
});

authChallengeDbSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AuthChallengeModel = model("AuthChallenge", authChallengeDbSchema);
