import { emailSchema, newPasswordSchema } from "@placta/contracts";
import { connectDb, disconnectDb } from "../database/connection.ts";
import { initModels } from "../database/indexes.ts";
import { countUsers, createUser } from "../repositories/auth.repository.ts";
import { hashPassword } from "../services/auth.service.ts";
import { ask, askHidden } from "./prompt.ts";

// One-time bootstrap: creates the first admin. Refuses once any user exists.
await connectDb();
await initModels();

try {
  if ((await countUsers()) > 0) throw new Error("A user already exists. Use reset-password to recover access.");

  const email = emailSchema.parse(await ask("Admin email: "));
  const name = (await ask("Display name: ")) || "Admin";
  const password = newPasswordSchema.parse(await askHidden("Password (min 12 chars): "));
  if (password !== (await askHidden("Repeat password: "))) throw new Error("Passwords do not match");

  const user = await createUser({ email, name, role: "admin", passwordHash: await hashPassword(password) });
  console.info(`Admin created: ${user.email}`);
}
catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
}
finally {
  await disconnectDb();
}
