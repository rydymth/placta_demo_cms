import { PageModel } from "../models/page.model.ts";
import { RevisionModel } from "../models/revision.model.ts";
import { UserModel } from "../models/user.model.ts";
import { PasskeyModel } from "../models/passkey.model.ts";
import { RefreshTokenModel } from "../models/refresh-token.model.ts";
import { AuthChallengeModel } from "../models/auth-challenge.model.ts";
import { AuditLogModel } from "../models/audit-log.model.ts";
import { EditLockModel } from "../models/edit-lock.model.ts";

const models = [
  PageModel,
  RevisionModel,
  UserModel,
  PasskeyModel,
  RefreshTokenModel,
  AuthChallengeModel,
  AuditLogModel,
  EditLockModel,
];

// Builds every declared index before the server accepts requests.
export const initModels = (): Promise<unknown> => Promise.all(models.map((m) => m.init()));
