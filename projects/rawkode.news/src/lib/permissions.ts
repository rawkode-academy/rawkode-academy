import { eq } from "drizzle-orm";
import { postCategories, type PostCategory } from "@/components/app-data";
import { getDb } from "@/db";
import { roles } from "@/db/schema";
import type { TypedEnv } from "@/types/service-bindings";

const ADMIN_ROLE = "admin";

export type Permissions = {
  canSubmitRka: boolean;
  allowedCategories: PostCategory[];
};

export const getPermissions = async (
  env: TypedEnv,
  userId: string,
): Promise<Permissions> => {
  const db = getDb(env);
  const [role] = await db
    .select({ role: roles.role })
    .from(roles)
    .where(eq(roles.id, userId))
    .limit(1);
  const canSubmitRka = role?.role === ADMIN_ROLE;

  return {
    canSubmitRka,
    allowedCategories: postCategories.filter(
      (category) => category !== "rka" || canSubmitRka,
    ),
  };
};
