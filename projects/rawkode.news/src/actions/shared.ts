import { type ActionAPIContext, ActionError } from "astro:actions";
import { env } from "cloudflare:workers";
import { getSessionWithPermissions } from "@/core/server/session";
import { asRequestError, RequestError } from "@/server/errors";

export const raiseActionError = (error: unknown): never => {
  const requestError = asRequestError(error);
  throw new ActionError({
    code: ActionError.statusToCode(requestError.status),
    message: requestError.message,
  });
};

export const requireSession = async (context: ActionAPIContext) => {
  const { session, permissions } = await getSessionWithPermissions(env, context.cookies);
  if (!session || !permissions) {
    throw new RequestError("Sign in required", 401);
  }
  return { env, session, permissions };
};

export const requireAdmin = async (context: ActionAPIContext) => {
  const { env, session, permissions } = await requireSession(context);
  if (!permissions.isAdmin) {
    throw new RequestError("Admin role required", 403);
  }
  return { env, session, permissions };
};
