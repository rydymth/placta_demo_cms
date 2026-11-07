import { Schema, model } from "mongoose";

const passkeyDbSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    credentialId: { type: String, required: true, unique: true },
    publicKey: { type: String, required: true }, // base64url
    counter: { type: Number, required: true, default: 0 },
    transports: { type: [String], default: [] },
    deviceType: { type: String, required: true },
    backedUp: { type: Boolean, required: true },
    name: { type: String, required: true },
    lastUsedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const PasskeyModel = model("PasskeyCredential", passkeyDbSchema);
