import { eq } from "drizzle-orm";
import type { MandatoryTagSlug } from "@/components/app-data";
import { mandatoryTagSlugs } from "@/components/app-data";
import { getDb } from "@/db";
import { roles } from "@/db/schema";
import type { TypedEnv } from "@/types/service-bindings";

const ADMIN_ROLE = "admin";

export type Permissions = {
  isAdmin: boolean;
  canSubmitRka: boolean;
  allowedMandatoryTags: MandatoryTagSlug[];
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

  const isAdmin = role?.role === ADMIN_ROLE;
  const canSubmitRka = isAdmin;

  return {
    isAdmin,
    canSubmitRka,
    allowedMandatoryTags: mandatoryTagSlugs.filter(
      (slug) => slug !== "rka" || canSubmitRka,
    ),
  };
};
