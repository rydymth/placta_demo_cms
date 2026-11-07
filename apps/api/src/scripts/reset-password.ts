import { newPasswordSchema } from "@placta/contracts";
import { connectDb, disconnectDb } from "../database/connection.ts";
import {
  findUserByEmail,
  revokeAllRefreshForUser,
  setPasswordHash,
} from "../repositories/auth.repository.ts";
import { hashPassword } from "../services/auth.service.ts";
import { ask, askHidden } from "./prompt.ts";

// Recovery path while there is no email flow: run on the server, signs everyone out.
await connectDb();

try {
  const user = await findUserByEmail(await ask("User email: "));
  if (!user) throw new Error("No such user");

  const password = newPasswordSchema.parse(await askHidden("New password (min 12 chars): "));
  if (password !== (await askHidden("Repeat password: "))) throw new Error("Passwords do not match");

  await setPasswordHash(user.id, await hashPassword(password));
  await revokeAllRefreshForUser(user.id);
  console.info(`Password updated for ${user.email}; all sessions revoked`);
}
catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
}
finally {
  await disconnectDb();
}
